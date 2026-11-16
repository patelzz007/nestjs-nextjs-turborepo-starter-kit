#!/usr/bin/env node
// `pnpm docs:sync` runs one sync; `pnpm docs:sync report` tells the platform how it went (ADR 084).
//
//   run     --trigger MANUAL|SCHEDULE|WEBHOOK|NIGHTLY [--full] [--adopt]
//   report  [--pull-request-url <url>] [--commit <sha>]
//
// `run` writes the outcome to `.artifacts/docs-sync/report.json` and exits 1 only when the run was BLOCKED or
// FAILED: a run that held a page back still published the others. Secrets come from the environment and are
// never printed (`packages/docs-sync/.env.example` lists them).

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import { parseJson } from "@workspace/docs-content/json";
import { DocsSourceKindSchema, DocsSyncRunReportSchema, DocsSyncTriggerSchema, type DocsSyncRunReport } from "@workspace/shared";
import { z } from "zod";

import { setVariables } from "./cli-environment.ts";
import { FileContentStore } from "./content-store.ts";
import { sendRunReport, withPublicationFacts } from "./run-report.ts";
import { runSync } from "./run-sync.ts";
import { createSource, SourceConfigurationError } from "./sources/create-source.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const REPORT_FILE = path.join(REPO_ROOT, ".artifacts/docs-sync/report.json");
/** A line copied empty from `.env.example` counts as not set. */
const ENVIRONMENT = setVariables(process.env);
const FAILED_EXIT_CODE = 1;

const CliEnvironmentSchema = z.object({
	DOCS_SOURCE: DocsSourceKindSchema.default("NOTION"),
	DOCS_DEFAULT_AUTHOR: z.string().min(1).default("Platform Team"),
	DOCS_SYNC_API_URL: z.url().optional(),
	DOCS_SYNC_REPORT_TOKEN: z.string().min(1).optional(),
});

function say(line: string): void {
	process.stdout.write(`${line}\n`);
}

async function saveReport(report: DocsSyncRunReport): Promise<void> {
	await mkdir(path.dirname(REPORT_FILE), { recursive: true });
	await writeFile(REPORT_FILE, `${JSON.stringify(report, null, "\t")}\n`);
}

function printSummary(report: DocsSyncRunReport, warnings: readonly string[]): void {
	say(`Docs sync ${report.runId}: ${report.status}`);
	say(
		`  written ${String(report.pagesProcessed)}, unchanged ${String(report.pagesUnchanged)}, removed ${String(report.pagesRemoved)}, held back ${String(report.pagesHeldBack)}`,
	);
	if (report.errorSummary !== null) {
		say(`  ${report.errorSummary}`);
	}
	for (const page of report.heldBack) {
		say(`  Held back: ${page.title}`);
		for (const issue of page.issues) {
			say(`    ${issue.reason} ${issue.fix}`);
		}
	}
	for (const warning of warnings) {
		say(`  Warning: ${warning}`);
	}
}

async function run(args: readonly string[]): Promise<number> {
	const { values } = parseArgs({ args: [...args], options: { trigger: { type: "string" }, full: { type: "boolean" }, adopt: { type: "boolean" } }, strict: true });
	const trigger = DocsSyncTriggerSchema.parse(values.trigger ?? "MANUAL");
	const environment = CliEnvironmentSchema.parse(ENVIRONMENT);
	const { report, warnings } = await runSync(createSource(environment.DOCS_SOURCE, ENVIRONMENT), new FileContentStore(REPO_ROOT), {
		runId: randomUUID(),
		trigger,
		full: values.full === true || trigger === "NIGHTLY",
		adopt: values.adopt === true,
		defaultAuthor: environment.DOCS_DEFAULT_AUTHOR,
		now: () => Date.now(),
	});
	await saveReport(report);
	printSummary(report, warnings);
	return report.status === "BLOCKED" || report.status === "FAILED" ? FAILED_EXIT_CODE : 0;
}

async function report(args: readonly string[]): Promise<number> {
	const { values } = parseArgs({ args: [...args], options: { "pull-request-url": { type: "string" }, commit: { type: "string" } }, strict: true });
	const saved = DocsSyncRunReportSchema.parse(parseJson(await readFile(REPORT_FILE, "utf8")));
	const complete = withPublicationFacts(saved, { pullRequestUrl: values["pull-request-url"] ?? null, commitSha: values.commit ?? null });
	await saveReport(complete);
	const { DOCS_SYNC_API_URL: apiUrl, DOCS_SYNC_REPORT_TOKEN: token } = CliEnvironmentSchema.parse(ENVIRONMENT);
	if (apiUrl === undefined || token === undefined) {
		say("Not reported: DOCS_SYNC_API_URL and DOCS_SYNC_REPORT_TOKEN are not both set.");
		return 0;
	}
	await sendRunReport(complete, { apiUrl, token, fetch: (url, init) => globalThis.fetch(url, init) });
	say(`Reported run ${complete.runId}.`);
	return 0;
}

const [command = "run", ...rest] = process.argv.slice(2);
try {
	process.exitCode = await (command === "report" ? report(rest) : run(command === "run" ? rest : [command, ...rest]));
} catch (error) {
	if (!(error instanceof SourceConfigurationError)) {
		throw error;
	}
	process.stderr.write(`${error.message}\nCopy packages/docs-sync/.env.example to packages/docs-sync/.env and fill it in.\n`);
	process.exitCode = FAILED_EXIT_CODE;
}
