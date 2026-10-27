#!/usr/bin/env node
/**
 * `node packages/tooling/scripts/run-in-workspace.mjs <workspace> <bin> [args…]`
 *
 * Runs `<workspace>/node_modules/.bin/<bin>` from the workspace's own folder —
 * as its `pnpm run lint` does, so oxlint and oxfmt find the same config — and
 * exits with its exit code. The pre-commit hook's commands go through it
 * (lib/staged-lint.mjs) because lint-staged starts commands without a shell:
 * a `pnpm` that is a shebang-less shim (nvm's) cannot be started that way
 * (ENOEXEC), and lint-staged reports that failure but still exits 0, so the
 * check would silently not run. `node` always starts, and a binary that cannot
 * be started here is a failed run, never a skipped one.
 */
import path from "node:path";

import { runInWorkspace } from "./lib/run-in-workspace.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

process.exitCode = runInWorkspace(REPO_ROOT, process.argv.slice(2));
