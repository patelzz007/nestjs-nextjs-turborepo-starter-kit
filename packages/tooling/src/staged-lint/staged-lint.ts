// The pre-commit hook's commands (lint-staged.config.mjs). Every workspace
// formats and lints with its own oxfmt / oxlint and its own oxlint.config.ts,
// from its own folder (`pnpm run lint` runs them there), so the staged files
// are grouped by the workspace that owns them and each group runs that
// workspace's tools: format first (lint-staged re-stages what it rewrote),
// then lint. Ignore patterns still apply to files named on the command line,
// so a group can end up with nothing to check (apps/admin ignores its own
// vitest.config.ts): both tools get `--no-error-on-unmatched-pattern`, exactly
// as `pnpm run lint` passes over an ignored file without failing.
// Each command starts `node` (src/run-in-workspace/cli.ts), never the `pnpm`
// shim: lint-staged spawns without a shell, and a shim it cannot start counts
// as a pass (see that script).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/** The extensions `pnpm run lint` formats and lints in every workspace (its oxfmt glob). */
export const LINTED_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

/** The lint-staged glob for {@link LINTED_EXTENSIONS}. */
export const LINTED_GLOB = `*.{${LINTED_EXTENSIONS.join(",")}}`;

/**
 * The workspace that lints `file`: the nearest folder above it, below
 * `repoRoot`, whose package.json has a `lint` script. `undefined` when none
 * does (the repository root's own `lint` only runs Turborepo).
 * @param repoRoot absolute
 * @param file absolute
 */

export function owningWorkspace(repoRoot: string, file: string, hasLintScript: (packageJsonPath: string) => boolean = packageHasLintScript): string | undefined {
	let directory = path.dirname(file);
	while (directory.startsWith(`${repoRoot}${path.sep}`)) {
		if (hasLintScript(path.join(directory, "package.json"))) {
			return directory;
		}
		directory = path.dirname(directory);
	}
	return undefined;
}

const ManifestScriptsSchema = z.object({ scripts: z.record(z.string(), z.string()).optional() });

function packageHasLintScript(packageJsonPath: string): boolean {
	if (!existsSync(packageJsonPath)) {
		return false;
	}
	return ManifestScriptsSchema.parse(JSON.parse(readFileSync(packageJsonPath, "utf8"))).scripts?.lint !== undefined;
}

function quoted(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** The runner every command starts (repo-relative). */
export const RUN_IN_WORKSPACE = "packages/tooling/src/run-in-workspace/cli.ts";

/**
 * The commands for `files` (absolute paths): per owning workspace, in the
 * order first seen, its oxfmt (writing) and then its oxlint, on that
 * workspace's files only. Files no workspace lints are left alone. Commands
 * run from `repoRoot` (lint-staged's working directory under the hook).
 * @param repoRoot absolute
 * @param files absolute
 */

export function stagedLintCommands(
	repoRoot: string,
	files: readonly string[],
	workspaceOf: (file: string) => string | undefined = (file) => owningWorkspace(repoRoot, file),
): string[] {
	const byWorkspace = new Map<string, string[]>();
	for (const file of files) {
		const workspace = workspaceOf(file);
		if (workspace !== undefined) {
			byWorkspace.set(workspace, [...(byWorkspace.get(workspace) ?? []), quoted(path.relative(workspace, file))]);
		}
	}
	return [...byWorkspace].flatMap(([workspace, workspaceFiles]) => {
		const dir = quoted(path.relative(repoRoot, workspace));
		const list = workspaceFiles.join(" ");
		const run = `node ${RUN_IN_WORKSPACE} ${dir}`;
		return [`${run} oxfmt --no-error-on-unmatched-pattern ${list}`, `${run} oxlint --no-error-on-unmatched-pattern ${list}`];
	});
}
