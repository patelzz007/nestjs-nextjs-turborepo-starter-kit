#!/usr/bin/env node
/**
 * `pnpm tools dev:timing [--mode warm|cold] [--runs <n>] [--cwd <repo root>]`
 *
 * Measures local startup in four phases (plan §19.1, decision #53): A. `pnpm
 * dev` until every port answers, B. API process spawned until `/health/ready`
 * is 200 (plus the API's own `markPhase` lines), C. the first signed-in GET
 * of a representative route per Next app, D. the first iOS Metro bundle.
 * `--mode cold` first deletes `.turbo`, every `.next`, `apps/api/dist` and
 * Metro's caches; `warm` deletes nothing. Prints a median table and writes
 * `.artifacts/dev-timing/latest.json` (gitignored) plus each run's dev log.
 *
 * Needs the usual local services (Postgres, Redis, Kafka, RabbitMQ, Mailpit)
 * and a seeded database, and refuses to start while any dev port is taken.
 * Targets live in rules/19; there is deliberately no CI gate (decision #54).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { formatSummaryTable } from "./report.ts";
import { runDevTiming } from "./run-dev-timing.ts";
import { summarizeRuns } from "./timing.ts";
import { settings } from "../shared/settings.ts";

/** The repository root, four levels above this file (packages/tooling/src/dev-timing). */
const DEFAULT_REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..", "..");
/** Where results are written, relative to the measured repository (gitignored). */
const OUTPUT_DIRECTORY = settings.artifacts.devTiming;
/** Indentation of the written JSON. */
const JSON_INDENT = 2;
/** Arguments after `node <script>`. */
const FIRST_USER_ARGUMENT = 2;

const ArgsSchema = z.object({
	mode: z.enum(["warm", "cold"]).default("warm"),
	runs: z.coerce.number().int().positive().default(1),
	cwd: z.string().min(1).default(DEFAULT_REPO_ROOT),
});

async function main(): Promise<void> {
	const { values } = parseArgs({
		args: process.argv.slice(FIRST_USER_ARGUMENT),
		options: { mode: { type: "string" }, runs: { type: "string" }, cwd: { type: "string" } },
		strict: true,
	});
	const args = ArgsSchema.parse(values);
	const repoRoot = path.resolve(args.cwd);
	const outputDirectory = path.join(repoRoot, OUTPUT_DIRECTORY);
	await mkdir(outputDirectory, { recursive: true });

	// Ctrl-C stops the measured stack (its own process group) instead of orphaning it.
	const interrupted = new AbortController();
	for (const signal of ["SIGINT", "SIGTERM"]) {
		process.once(signal, () => {
			interrupted.abort(new Error(`interrupted by ${signal}`));
		});
	}

	const runs = [];
	// One sign-in per demo account for every run of this invocation.
	const sessions = new Map<string, string>();
	for (let run = 1; run <= args.runs && !interrupted.signal.aborted; run += 1) {
		process.stdout.write(`dev:timing — ${args.mode} run ${String(run)}/${String(args.runs)} in ${repoRoot}\n`);
		const logPath = path.join(outputDirectory, `${args.mode}-run-${String(run)}.log`);
		const result = await runDevTiming({ repoRoot, mode: args.mode, logPath, signal: interrupted.signal, sessions });
		for (const error of result.errors) {
			process.stderr.write(`  ✗ ${error}\n`);
		}
		runs.push(result);
	}

	const summary = summarizeRuns(runs.map((result) => result.measurements));
	await writeFile(path.join(outputDirectory, "latest.json"), `${JSON.stringify({ mode: args.mode, repoRoot, summary, runs }, null, JSON_INDENT)}\n`);
	process.stdout.write(`\n${formatSummaryTable(summary)}\n\n`);
	for (const result of runs) {
		const boot = result.apiBootPhases.map((phase) => `${phase.label} +${String(phase.stepMs)}ms`).join(" · ");
		process.stdout.write(`API markPhase (run started ${new Date(result.startedAt).toISOString()}): ${boot}\n`);
	}
	process.stdout.write(`\nWrote ${path.join(OUTPUT_DIRECTORY, "latest.json")}\n`);
	if (runs.some((result) => result.errors.length > 0)) {
		process.exitCode = 1;
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`dev:timing failed: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
