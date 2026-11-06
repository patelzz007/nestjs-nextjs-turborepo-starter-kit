#!/usr/bin/env node
/**
 * `pnpm tools bundle:check [--write-baseline] [--cwd <repo root>]`
 *
 * Per-route first-load JS (gzip) of the three Next apps and the Hermes bundle
 * of each mobile platform, checked against `budgets/bundle.json` at the repo
 * root (plan §19.6, decisions #57 and #64). Run after `turbo run build`: it
 * reads each app's `.next/` and `apps/mobile/dist/`. Exits 1 when an entry is
 * over budget, has no budget (a new route must add one), or has a budget for
 * a route that no longer exists.
 *
 * `--write-baseline` writes measured × BUDGET_HEADROOM (rounded up to KiB)
 * instead. Raising a budget later is a reviewed edit of that file.
 */
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { BYTES_PER_KIB, BudgetsSchema, baselineBudgets, compareToBudgets, failingRows } from "./budgets.ts";
import { readNextRouteChunks } from "./next-routes.ts";
import { readExpoBundleSizes, sumGzipSizes } from "./sizes.ts";
import { settings } from "../shared/settings.ts";

/** The repository root, four levels above this file (packages/tooling/src/bundle-budget). */
const DEFAULT_REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const BUDGETS_FILE = settings.budgets.bundle;
/** The Next apps whose routes have budgets; each is built into `apps/<app>/.next`. */
const NEXT_APPS = settings.nextApps;
/** The budgets key of the mobile app and the platforms its CI build exports (apps/mobile `build`). */
const MOBILE_APP = "mobile";
const MOBILE_PLATFORMS = ["ios", "android"];
const MOBILE_EXPORT_DIR = path.join("apps", "mobile", "dist");
/** Indentation of the written budgets file (the repo's JSON style). */
const JSON_INDENT = "\t";
/** Decimals of the KiB figures in the report. */
const KIB_DECIMALS = 1;
/** Arguments after `node <script>`. */
const FIRST_USER_ARGUMENT = 2;

const ArgsSchema = z.object({
	"write-baseline": z.boolean().default(false),
	cwd: z.string().min(1).default(DEFAULT_REPO_ROOT),
});

const reader = {
	readText: (file: string): Promise<string> => readFile(file, "utf8"),
	readBytes: (file: string): Promise<Buffer> => readFile(file),
	fileSize: async (file: string): Promise<number> => (await stat(file)).size,
};

async function measure(repoRoot: string): Promise<Record<string, Map<string, number>>> {
	const measured: Record<string, Map<string, number>> = {};
	for (const app of NEXT_APPS) {
		const buildDir = path.join(repoRoot, "apps", app, ".next");
		const routes = await readNextRouteChunks(buildDir, reader);
		const sizes = new Map<string, number>();
		for (const [route, chunks] of routes) {
			sizes.set(route, await sumGzipSizes(chunks, (chunk) => reader.readBytes(path.join(buildDir, chunk))));
		}
		measured[app] = sizes;
	}
	measured[MOBILE_APP] = await readExpoBundleSizes(path.join(repoRoot, MOBILE_EXPORT_DIR), MOBILE_PLATFORMS, reader);
	return measured;
}

function kib(bytes: number | undefined): string {
	return bytes === undefined ? "—" : `${(bytes / BYTES_PER_KIB).toFixed(KIB_DECIMALS)} KiB`;
}

async function main(): Promise<void> {
	const { values } = parseArgs({
		args: process.argv.slice(FIRST_USER_ARGUMENT),
		options: { "write-baseline": { type: "boolean" }, cwd: { type: "string" } },
		strict: true,
	});
	const args = ArgsSchema.parse(values);
	const repoRoot = path.resolve(args.cwd);
	const budgetsPath = path.join(repoRoot, BUDGETS_FILE);
	const measured = await measure(repoRoot);

	if (args["write-baseline"]) {
		await writeFile(budgetsPath, `${JSON.stringify(baselineBudgets(measured), null, JSON_INDENT)}\n`);
		process.stdout.write(`Wrote ${BUDGETS_FILE} (measured × headroom, rounded up to KiB). Commit it.\n`);
		return;
	}

	let budgets;
	try {
		budgets = BudgetsSchema.parse(JSON.parse(await readFile(budgetsPath, "utf8")));
	} catch (error) {
		throw new Error(`cannot read ${BUDGETS_FILE} (${error instanceof Error ? error.message : String(error)}); generate it with \`pnpm tools bundle:check --write-baseline\``, {
			cause: error,
		});
	}
	const rows = compareToBudgets(measured, budgets);
	for (const row of rows) {
		process.stdout.write(
			`${row.status === "ok" ? "✓" : "✗"} ${row.app} ${row.entry}: ${kib(row.measured)} / budget ${kib(row.budget)}${row.status === "ok" ? "" : ` — ${row.status}`}\n`,
		);
	}
	const failures = failingRows(rows);
	if (failures.length > 0) {
		process.stderr.write(`\n${String(failures.length)} bundle budget failure(s). A deliberate increase is an edit of ${BUDGETS_FILE} in the same PR.\n`);
		process.exitCode = 1;
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`bundle:check failed: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
