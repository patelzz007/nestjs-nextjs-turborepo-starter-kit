#!/usr/bin/env node
/**
 * `pnpm bundle:check [--write-baseline] [--cwd <repo root>]`
 *
 * Per-route first-load JS (gzip) of the three Next apps and the Hermes bundle
 * of each mobile platform, checked against `bundle-budgets.json` at the repo
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

import { BYTES_PER_KIB, BudgetsSchema, baselineBudgets, compareToBudgets, failingRows } from "./budgets.mjs";
import { readNextRouteChunks } from "./next-routes.mjs";
import { readExpoBundleSizes, sumGzipSizes } from "./sizes.mjs";

/** The repository root, four levels above this file (packages/tooling/src/bundle-budget). */
const DEFAULT_REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const BUDGETS_FILE = "bundle-budgets.json";
/** The Next apps whose routes have budgets; each is built into `apps/<app>/.next`. */
const NEXT_APPS = ["web", "admin", "merchant"];
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
	readText: (/** @type {string} */ file) => readFile(file, "utf8"),
	readBytes: (/** @type {string} */ file) => readFile(file),
	fileSize: async (/** @type {string} */ file) => (await stat(file)).size,
};

/**
 * @param {string} repoRoot
 * @returns {Promise<Record<string, Map<string, number>>>}
 */
async function measure(repoRoot) {
	/** @type {Record<string, Map<string, number>>} */
	const measured = {};
	for (const app of NEXT_APPS) {
		const buildDir = path.join(repoRoot, "apps", app, ".next");
		const routes = await readNextRouteChunks(buildDir, reader);
		/** @type {Map<string, number>} */
		const sizes = new Map();
		for (const [route, chunks] of routes) {
			sizes.set(route, await sumGzipSizes(chunks, (chunk) => reader.readBytes(path.join(buildDir, chunk))));
		}
		measured[app] = sizes;
	}
	measured[MOBILE_APP] = await readExpoBundleSizes(path.join(repoRoot, MOBILE_EXPORT_DIR), MOBILE_PLATFORMS, reader);
	return measured;
}

/**
 * @param {number | undefined} bytes
 * @returns {string}
 */
function kib(bytes) {
	return bytes === undefined ? "—" : `${(bytes / BYTES_PER_KIB).toFixed(KIB_DECIMALS)} KiB`;
}

async function main() {
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
		console.log(`Wrote ${BUDGETS_FILE} (measured × headroom, rounded up to KiB). Commit it.`);
		return;
	}

	let budgets;
	try {
		budgets = BudgetsSchema.parse(JSON.parse(await readFile(budgetsPath, "utf8")));
	} catch (error) {
		throw new Error(`cannot read ${BUDGETS_FILE} (${error instanceof Error ? error.message : String(error)}); generate it with \`pnpm bundle:check --write-baseline\``, {
			cause: error,
		});
	}
	const rows = compareToBudgets(measured, budgets);
	for (const row of rows) {
		console.log(
			`${row.status === "ok" ? "✓" : "✗"} ${row.app} ${row.entry}: ${kib(row.measured)} / budget ${kib(row.budget)}${row.status === "ok" ? "" : ` — ${row.status}`}`,
		);
	}
	const failures = failingRows(rows);
	if (failures.length > 0) {
		console.error(`\n${String(failures.length)} bundle budget failure(s). A deliberate increase is an edit of ${BUDGETS_FILE} in the same PR.`);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(`bundle:check failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
