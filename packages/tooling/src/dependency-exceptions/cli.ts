#!/usr/bin/env node
/**
 * Scheduled review of the time-boxed dependency decisions in pnpm-workspace.yaml
 * (accepted advisories and supply-chain cooldown exceptions). Run by the weekly
 * `dependency-review` workflow — NOT on every push, so a passing calendar day
 * never blocks a push. Exits 1 (and lists what to do) when any entry is due.
 *
 * Usage: node packages/tooling/src/dependency-exceptions/cli.ts [--today YYYY-MM-DD]
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { dueExceptions, isIsoCalendarDate, parseDependencyExceptions, structuralProblems } from "./dependency-exceptions.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const ISO_DATE_LENGTH = 10;

function resolveToday(argv: readonly string[]): string {
	const flagIndex = argv.indexOf("--today");
	if (flagIndex === -1) {
		return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
	}
	const value = argv.at(flagIndex + 1) ?? null;
	if (!isIsoCalendarDate(value)) {
		process.stderr.write("--today must be a YYYY-MM-DD date\n");
		process.exit(64);
	}
	return value;
}

const ACTIONS = {
	"accepted-advisory":
		"re-check the advisory: if a patched release exists, upgrade and delete the entry; otherwise confirm it is still unreachable and move review-by forward",
	"cooldown-exception": "the version is past the cooldown now — delete the entry (and its override, if the lockfile already resolves a patched version)",
};

const today = resolveToday(process.argv.slice(2));
const exceptions = parseDependencyExceptions(readFileSync(path.join(REPO_ROOT, "pnpm-workspace.yaml"), "utf8"));
const problems = structuralProblems(exceptions);
const due = dueExceptions(exceptions, today);

for (const problem of problems) {
	process.stderr.write(`✗ ${problem}\n`);
}
for (const exception of due) {
	process.stderr.write(`✗ ${exception.id} (${exception.kind}, dated ${String(exception.date)}): ${ACTIONS[exception.kind]}\n`);
}
if (problems.length > 0 || due.length > 0) {
	process.exit(1);
}
process.stdout.write(`Dependency exceptions OK on ${today}: ${String(exceptions.length)} entr${exceptions.length === 1 ? "y" : "ies"}, none due.\n`);
