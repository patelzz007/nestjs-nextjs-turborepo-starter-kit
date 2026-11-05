#!/usr/bin/env node
// `node packages/tooling/scripts/ci-changes.mjs` (CI's `changes` job, enhancement 3.6): writes `code=true` or
// `code=false` to the `--output` file ($GITHUB_OUTPUT). false only for a pull request whose every changed file
// is documentation (lib/ci-changes.mjs). Takes `--event` (the GitHub event name) and `--base`
// (`origin/<base branch>`) as arguments; needs the checkout's full history, for the merge base. A failed
// `git diff` fails the job, so no job is ever skipped on a guess.

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

import { changedFilesArgs, changedFilesOf, codeChanged, outputLines, parseChangesArgs } from "./lib/ci-changes.mjs";

const { eventName, baseRef, outputFile } = parseChangesArgs(process.argv.slice(2));
let changedFiles = [];
if (eventName === "pull_request") {
	const diff = spawnSync("git", changedFilesArgs(baseRef), { encoding: "utf8" });
	if (diff.status !== 0) {
		process.stderr.write(diff.stderr);
		process.exit(diff.status ?? 1);
	}
	changedFiles = changedFilesOf(diff.stdout);
}
const code = codeChanged(eventName, changedFiles);
process.stdout.write(`${eventName}: ${String(changedFiles.length)} changed file(s); ${code ? "code changed, every job runs" : "documentation only, the code jobs skip"}\n`);
if (outputFile !== undefined) {
	appendFileSync(outputFile, outputLines(code));
}
