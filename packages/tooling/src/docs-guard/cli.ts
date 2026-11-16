#!/usr/bin/env node
// `node packages/tooling/src/docs-guard/cli.ts` (ADR 084). Reads the pull request from the environment and answers:
//
//   check     CI's Docs guard job: a person's pull request may not edit a generated file and must carry a "Docs:"
//             line when code changed; the sync's may touch only what the sync owns. Exits 1 with the reason.
//   classify  writes `routine=true|false` to --output: whether the sync's pull request may merge by itself.
//
// --base is the branch compared against (origin/main). PR_AUTHOR, PR_BODY and PR_BRANCH come from the workflow's `env`:
// a pull request's title or body is never put into a shell command.

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { z } from "zod";

import { codeChanged } from "../ci-changes/ci-changes.ts";
import {
	docsLineProblem,
	handEditedGeneratedFiles,
	isBotAuthor,
	MANIFEST_PATH,
	outOfBoundsFiles,
	parseManifestText,
	parseNameStatus,
	reviewReasons,
	SYNC_BRANCH_PREFIX,
} from "./docs-guard.ts";

const PullRequestEnvironmentSchema = z.object({
	PR_AUTHOR: z.string().default(""),
	PR_BODY: z.string().default(""),
	PR_BRANCH: z.string().default(""),
});

function git(args: readonly string[]): { readonly ok: boolean; readonly stdout: string } {
	const result = spawnSync("git", [...args], { encoding: "utf8" });
	return { ok: result.status === 0, stdout: result.stdout };
}

function say(line: string): void {
	process.stdout.write(`${line}\n`);
}

const { values, positionals } = parseArgs({ allowPositionals: true, options: { base: { type: "string" }, output: { type: "string" } }, strict: true });
const [mode = "check"] = positionals;
const base = values.base ?? "origin/main";
const diff = git(["diff", "--name-status", "--no-renames", `${base}...HEAD`]);
if (!diff.ok) {
	process.stderr.write(`Could not compare with ${base}.\n`);
	process.exit(1);
}
const files = parseNameStatus(diff.stdout);
const shown = git(["show", `${base}:${MANIFEST_PATH}`]);
const before = parseManifestText(shown.ok ? shown.stdout : null);
const current = git(["show", `HEAD:${MANIFEST_PATH}`]);
const after = parseManifestText(current.ok ? current.stdout : null);
const { PR_AUTHOR: author, PR_BODY: body, PR_BRANCH: branch } = PullRequestEnvironmentSchema.parse(process.env);

function fail(problems: readonly string[]): void {
	for (const problem of problems) {
		process.stderr.write(`${problem}\n`);
	}
	process.exitCode = 1;
}

if (mode === "classify") {
	const reasons = reviewReasons(files, before, after);
	const outOfBounds = outOfBoundsFiles(files, before, after);
	const isRoutine = reasons.length === 0 && outOfBounds.length === 0;
	say(isRoutine ? "Routine edit: it may merge by itself." : `Needs a person:\n  ${[...reasons, ...outOfBounds].join("\n  ")}`);
	if (values.output !== undefined) {
		appendFileSync(values.output, `routine=${String(isRoutine)}\n`);
	}
} else if (branch.startsWith(SYNC_BRANCH_PREFIX)) {
	const outOfBounds = outOfBoundsFiles(files, before, after);
	if (outOfBounds.length > 0) {
		fail([`The sync may only change what it owns, not:`, ...outOfBounds]);
	}
} else {
	const handEdited = handEditedGeneratedFiles(files, before);
	if (handEdited.length > 0) {
		fail([`These files are generated: edit them in their writing tool.`, ...handEdited]);
	}
	const paths = files.map((file) => file.path);
	const problem = isBotAuthor(author) || !codeChanged("pull_request", paths) ? null : docsLineProblem(body);
	if (problem !== null) {
		fail([problem]);
	}
}
