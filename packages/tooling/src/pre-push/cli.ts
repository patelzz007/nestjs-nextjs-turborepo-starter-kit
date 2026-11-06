#!/usr/bin/env node
/**
 * The pre-push hook (.husky/pre-push): runs ci:local's lint, typecheck and unit-test steps — the exact commands of
 * ci:local and CI — and blocks the push when any of them fails, showing each test file as it finishes (a full run
 * takes minutes, and a silent one looks frozen). Lint and typecheck skip every workspace whose inputs did not change
 * since its last green run (Turborepo's cache); the unit tests always run in full (`test` is uncached in turbo.json).
 *
 * The database and browser suites are not run here (they need Postgres, Redis
 * and built apps); run `pnpm ci:local` for those. CI runs everything.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { NON_INTERACTIVE_ENV, selectSteps, staticSteps } from "../ci-local/ci-local-plan.ts";
import { settings } from "../shared/settings.ts";
import { describePush, parsePushRefs } from "../terminal-progress/change-summary.ts";
import { runChecks, terminalStream } from "../terminal-progress/run-checks.ts";
import { PRE_PUSH_LABELS, PRE_PUSH_STEP_IDS, pushesNothingNew } from "./pre-push.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const STDIN_FD = 0;
/** git names the remote as the hook's first argument; run by hand there is none. */
const REMOTE_ARGUMENT = 2;
const DEFAULT_REMOTE = "origin";

// git always pipes the refs in; run by hand from a terminal, check everything.
const refsText = process.stdin.isTTY ? undefined : readFileSync(STDIN_FD, "utf8");
const onlyDeletions = refsText !== undefined && pushesNothingNew(refsText);
const git = (args: readonly string[]): string => spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" }).stdout;

if (onlyDeletions) {
	process.stdout.write("pre-push: only deleting remote refs — nothing to check.\n");
} else {
	const steps = selectSteps(staticSteps({ base: "origin/main", noCache: false }), PRE_PUSH_STEP_IDS);
	const passed = await runChecks({
		title: "Checking your push",
		changes: describePush(parsePushRefs(refsText ?? ""), process.argv.at(REMOTE_ARGUMENT) ?? DEFAULT_REMOTE, git),
		action: "push",
		checks: steps.map((step) => ({
			id: step.id,
			label: PRE_PUSH_LABELS[step.id] ?? step.job,
			task: step.id,
			command: step.command,
			args: step.args,
			env: { ...NON_INTERACTIVE_ENV, ...step.env },
		})),
		cwd: REPO_ROOT,
		stream: terminalStream(),
		logFile: path.join(REPO_ROOT, settings.artifacts.ci, "pre-push.log"),
		historyFile: path.join(REPO_ROOT, settings.artifacts.ci, "pre-push.history.json"),
		nextStep: "Pushing to GitHub…",
	});
	process.exitCode = passed ? 0 : 1;
}
