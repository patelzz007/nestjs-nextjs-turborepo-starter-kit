#!/usr/bin/env node
/**
 * Scheduled review of the time-boxed dependency decisions in pnpm-workspace.yaml
 * (accepted advisories and supply-chain cooldown exceptions). Run by the weekly
 * `dependency-review` workflow — NOT on every push, so a passing calendar day
 * never blocks a push. Exits 1 (and lists what to do) when any entry is due.
 *
 * Usage: node packages/tooling/scripts/check-dependency-exceptions.mjs [--today YYYY-MM-DD]
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { dueExceptions, isIsoCalendarDate, parseDependencyExceptions, structuralProblems } from "./lib/dependency-exceptions.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const ISO_DATE_LENGTH = 10;

function resolveToday(argv) {
	const flagIndex = argv.indexOf("--today");
	if (flagIndex === -1) {
		return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
	}
	const value = argv[flagIndex + 1] ?? null;
	if (!isIsoCalendarDate(value)) {
		console.error("--today must be a YYYY-MM-DD date");
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
	console.error(`✗ ${problem}`);
}
for (const exception of due) {
	console.error(`✗ ${exception.id} (${exception.kind}, dated ${String(exception.date)}): ${ACTIONS[exception.kind]}`);
}
if (problems.length > 0 || due.length > 0) {
	process.exit(1);
}
console.log(`Dependency exceptions OK on ${today}: ${String(exceptions.length)} entr${exceptions.length === 1 ? "y" : "ies"}, none due.`);
