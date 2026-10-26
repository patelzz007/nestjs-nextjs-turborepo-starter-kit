import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** The file that marks the root of this pnpm monorepo. */
export const WORKSPACE_MARKER = "pnpm-workspace.yaml";

/**
 * The monorepo root above `startDirectory` (the nearest folder holding
 * {@link WORKSPACE_MARKER}), or `null` when there is none — a deployed bundle
 * runs without the repository around it. `hasFile` is the file system check
 * (injectable for tests).
 */
export function findWorkspaceRoot(startDirectory: string, hasFile: (path: string) => boolean = existsSync): string | null {
	let directory: string = resolve(startDirectory);
	for (;;) {
		if (hasFile(join(directory, WORKSPACE_MARKER))) {
			return directory;
		}
		const parent: string = dirname(directory);
		if (parent === directory) {
			return null;
		}
		directory = parent;
	}
}

/**
 * Where a configured path points: an absolute path as it is; a relative one
 * from the monorepo root, so every app and script finds the same folder
 * whatever its working directory (`apps/api` under `pnpm dev`, the root under
 * a root script). Without a monorepo around it, from the working directory.
 */
export function resolveFromWorkspaceRoot(path: string, workingDirectory: string, hasFile: (path: string) => boolean = existsSync): string {
	if (isAbsolute(path)) {
		return path;
	}
	return resolve(findWorkspaceRoot(workingDirectory, hasFile) ?? workingDirectory, path);
}
