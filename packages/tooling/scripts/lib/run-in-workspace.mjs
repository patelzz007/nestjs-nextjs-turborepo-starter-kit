// scripts/run-in-workspace.mjs: run a workspace's own binary from its folder.

import { spawnSync } from "node:child_process";
import path from "node:path";

/** The exit code of a run that could not start, or was given no binary. */
export const FAILED_TO_RUN = 1;

/**
 * Runs `<workspace>/node_modules/.bin/<bin> …args` with the workspace folder
 * as its working directory (through `sh`, so a shebang-less shim still
 * starts) and returns its exit code. `workspace` is relative to `repoRoot`.
 *
 * @param {string} repoRoot
 * @param {readonly string[]} argv `[workspace, bin, ...args]`
 * @param {typeof spawnSync} [spawn]
 * @returns {number}
 */
export function runInWorkspace(repoRoot, argv, spawn = spawnSync) {
	const [workspace, bin, ...args] = argv;
	if (workspace === undefined || bin === undefined) {
		console.error("usage: run-in-workspace.mjs <workspace> <bin> [args…]");
		return FAILED_TO_RUN;
	}
	const cwd = path.resolve(repoRoot, workspace);
	const executable = path.join(cwd, "node_modules", ".bin", bin);
	const result = spawn("sh", ["-c", 'exec "$0" "$@"', executable, ...args], { cwd, stdio: "inherit" });
	if (result.error !== undefined) {
		console.error(`could not run ${executable}: ${result.error.message}`);
		return FAILED_TO_RUN;
	}
	return result.status ?? FAILED_TO_RUN;
}
