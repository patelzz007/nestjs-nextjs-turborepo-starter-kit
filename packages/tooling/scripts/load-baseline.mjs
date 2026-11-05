#!/usr/bin/env node
/**
 * The nightly load-test gate (enhancement 3.9), from the repository root:
 *
 *   pnpm tools load:run -- --api-url http://localhost:8080 --out .ci-logs/load-baseline.json
 *     Signs in as the seeded Platform Developer, starts load-baselines.json's run through the API, waits
 *     for the load runner to finish it, and writes the run's detail (needs the API with
 *     LOAD_TESTING_ENABLED=true and Redis, and apps/load-runner with k6 reading the same queue).
 *
 *   pnpm tools load:check -- --results .ci-logs/load-baseline.json [--summary <file>]
 *     Checks the run against load-baselines.json; exits 1 on a regression. `--summary` appends the
 *     report (Markdown) to a file: the workflow passes `$GITHUB_STEP_SUMMARY`.
 *
 *   pnpm tools load:check -- --results <file> --write-baseline --source "<where it was measured>" [--provisional]
 *     Recalibrates every p95 threshold from that run (measured × calibration.factor) instead. Use a
 *     results file from the nightly workflow's artifact: the thresholds are CI's. `--provisional` marks
 *     numbers measured anywhere else (they still need a CI measurement).
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { runLoadBaseline } from "./lib/load-baseline-run.mjs";
import { compareToLoadBaselines, formatLoadReport, parseLoadBaselines, parseLoadRunResults, recalibratedBaselines } from "./lib/load-baselines.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const BASELINES_FILE = path.join(REPO_ROOT, "load-baselines.json");
/** Indentation of the written baselines file (the repo's JSON style). */
const JSON_INDENT = "\t";
/** Arguments after `node <script>`. */
const FIRST_USER_ARGUMENT = 2;
const FAILED = 1;

const RunArgsSchema = z.object({
	"api-url": z.url().default("http://localhost:8080"),
	"admin-origin": z.url().default("http://localhost:3001"),
	// The seeded Platform Developer (apps/api/prisma/seed/users.ts): a demo account, not a secret.
	email: z.email().default("developer@example.com"),
	password: z.string().min(1).default("Developer@123"),
	out: z.string().min(1),
});

const CheckArgsSchema = z
	.object({
		results: z.string().min(1),
		summary: z.string().min(1).optional(),
		"write-baseline": z.boolean().default(false),
		source: z.string().min(1).optional(),
		provisional: z.boolean().default(false),
	})
	.refine((args) => !args["write-baseline"] || args.source !== undefined, { message: "--write-baseline needs --source: where the run was measured" });

/**
 * @param {readonly string[]} args
 * @returns {Promise<number>}
 */
async function run(args) {
	const { values } = parseArgs({
		args: [...args],
		options: { "api-url": { type: "string" }, "admin-origin": { type: "string" }, email: { type: "string" }, password: { type: "string" }, out: { type: "string" } },
	});
	const options = RunArgsSchema.parse(values);
	const baselines = parseLoadBaselines(await readFile(BASELINES_FILE, "utf8"));
	const detail = await runLoadBaseline({
		target: { apiUrl: options["api-url"].replace(/\/$/u, ""), adminOrigin: options["admin-origin"].replace(/\/$/u, ""), email: options.email, password: options.password },
		baselines,
		log: (line) => {
			process.stdout.write(`${line}\n`);
		},
	});
	await mkdir(path.dirname(path.resolve(options.out)), { recursive: true });
	await writeFile(options.out, `${JSON.stringify(detail, null, JSON_INDENT)}\n`);
	process.stdout.write(`Results written to ${options.out}\n`);
	return 0;
}

/**
 * @param {readonly string[]} args
 * @returns {Promise<number>}
 */
async function check(args) {
	const { values } = parseArgs({
		args: [...args],
		options: { results: { type: "string" }, summary: { type: "string" }, "write-baseline": { type: "boolean" }, source: { type: "string" }, provisional: { type: "boolean" } },
	});
	const options = CheckArgsSchema.parse(values);
	const baselines = parseLoadBaselines(await readFile(BASELINES_FILE, "utf8"));
	const results = parseLoadRunResults(await readFile(options.results, "utf8"));
	if (options["write-baseline"]) {
		const [measuredOn = ""] = new Date().toISOString().split("T");
		const updated = recalibratedBaselines(results, baselines, { measuredOn, source: options.source ?? "", provisional: options.provisional });
		await writeFile(BASELINES_FILE, `${JSON.stringify(updated, null, JSON_INDENT)}\n`);
		process.stdout.write(`Wrote ${BASELINES_FILE} (p95 × ${String(baselines.calibration.factor)}). Review the diff before committing it.\n`);
		return 0;
	}
	const verdict = compareToLoadBaselines(results, baselines);
	const report = formatLoadReport(verdict);
	process.stdout.write(report);
	if (options.summary !== undefined) {
		await appendFile(options.summary, report);
	}
	return verdict.ok ? 0 : FAILED;
}

const [command, ...rest] = process.argv.slice(FIRST_USER_ARGUMENT);
const commands = new Map([
	["run", run],
	["check", check],
]);
const handler = commands.get(command ?? "");
if (handler === undefined) {
	process.stderr.write("Usage: load-baseline.mjs run --out <file> [--api-url …] | check --results <file> [--summary <file>] [--write-baseline --source <text>]\n");
	process.exitCode = FAILED;
} else {
	try {
		process.exitCode = await handler(rest);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = FAILED;
	}
}
