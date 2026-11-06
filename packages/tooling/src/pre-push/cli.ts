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
import { readFileSync } from "node:fs";
import path from "node:path";

import { NON_INTERACTIVE_ENV, selectSteps, staticSteps } from "../ci-local/ci-local-plan.ts";
import { settings } from "../shared/settings.ts";
import { runChecks, terminalStream } from "../terminal-progress/run-checks.ts";
import { PRE_PUSH_LABELS, PRE_PUSH_STEP_IDS, pushesNothingNew } from "./pre-push.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const STDIN_FD = 0;

// git always pipes the refs in; run by hand from a terminal, check everything.
const onlyDeletions = !process.stdin.isTTY && pushesNothingNew(readFileSync(STDIN_FD, "utf8"));

if (onlyDeletions) {
	process.stdout.write("pre-push: only deleting remote refs — nothing to check.\n");
} else {
	const steps = selectSteps(staticSteps({ base: "origin/main", noCache: false }), PRE_PUSH_STEP_IDS);
	const passed = await runChecks({
		title: "Checking your push",
		subtitle: "The same lint, typecheck and unit tests as CI. This can take several minutes.",
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
		nextStep: "Pushing to GitHub…",
	});
	process.exitCode = passed ? 0 : 1;
}
