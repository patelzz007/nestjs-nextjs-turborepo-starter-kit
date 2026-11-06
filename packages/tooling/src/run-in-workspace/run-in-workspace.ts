// src/run-in-workspace/cli.ts: run a workspace's own binary from its folder.

import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import path from "node:path";

/** The exit code of a run that could not start, or was given no binary. */
export const FAILED_TO_RUN = 1;

/**
 * Runs `<workspace>/node_modules/.bin/<bin> …args` with the workspace folder
 * as its working directory (through `sh`, so a shebang-less shim still
 * starts) and returns its exit code. `workspace` is relative to `repoRoot`.
 * @param argv `[workspace, bin, ...args]`
 */

/** What `runInWorkspace` needs of `spawnSync`. */
export type SpawnRunner = (command: string, args: readonly string[], options: SpawnSyncOptions) => { readonly error?: Error | undefined; readonly status: number | null };

export function runInWorkspace(repoRoot: string, argv: readonly string[], spawn: SpawnRunner = spawnSync): number {
	const [workspace, bin, ...args] = argv;
	if (workspace === undefined || bin === undefined) {
		process.stderr.write("usage: src/run-in-workspace/cli.ts <workspace> <bin> [args…]\n");
		return FAILED_TO_RUN;
	}
	const cwd = path.resolve(repoRoot, workspace);
	const executable = path.join(cwd, "node_modules", ".bin", bin);
	const result = spawn("sh", ["-c", 'exec "$0" "$@"', executable, ...args], { cwd, stdio: "inherit" });
	if (result.error !== undefined) {
		process.stderr.write(`could not run ${executable}: ${result.error.message}\n`);
		return FAILED_TO_RUN;
	}
	return result.status ?? FAILED_TO_RUN;
}
