#!/usr/bin/env node
/**
 * The pre-push hook (.husky/pre-push): runs `pnpm ci:local --only lint,typecheck,test`
 * — the exact lint, typecheck and unit-test commands of ci:local and CI — and
 * blocks the push when any of them fails. Lint and typecheck skip every
 * workspace whose inputs did not change since its last green run (Turborepo's
 * cache); the unit tests always run in full (`test` is uncached in turbo.json).
 *
 * The database and browser suites are not run here (they need Postgres, Redis
 * and built apps); run `pnpm ci:local` for those. CI runs everything.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PRE_PUSH_STEP_IDS, pushesNothingNew } from "./lib/pre-push.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const STDIN_FD = 0;

// git always pipes the refs in; run by hand from a terminal, check everything.
const onlyDeletions = process.stdin.isTTY !== true && pushesNothingNew(readFileSync(STDIN_FD, "utf8"));

if (onlyDeletions) {
	console.log("pre-push: only deleting remote refs — nothing to check.");
} else {
	console.log(`pre-push: ${PRE_PUSH_STEP_IDS.join(", ")} (logs shown only for failures)`);
	const result = spawnSync(process.execPath, [path.join(REPO_ROOT, "packages/tooling/scripts/ci-local.mjs"), "--only", PRE_PUSH_STEP_IDS.join(","), "--errors-only"], {
		cwd: REPO_ROOT,
		stdio: "inherit",
	});
	process.exitCode = result.status ?? 1;
}
