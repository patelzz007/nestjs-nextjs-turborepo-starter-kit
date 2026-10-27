// The pre-commit hook's commands (lint-staged.config.mjs). Every workspace
// formats and lints with its own oxfmt / oxlint and its own oxlint.config.ts,
// from its own folder (`pnpm run lint` runs them there), so the staged files
// are grouped by the workspace that owns them and each group runs that
// workspace's tools: format first (lint-staged re-stages what it rewrote),
// then lint. Ignore patterns still apply to files named on the command line,
// so a group can end up with nothing to check (apps/admin ignores its own
// vitest.config.ts): both tools get `--no-error-on-unmatched-pattern`, exactly
// as `pnpm run lint` passes over an ignored file without failing.
// Each command starts `node` (scripts/run-in-workspace.mjs), never the `pnpm`
// shim: lint-staged spawns without a shell, and a shim it cannot start counts
// as a pass (see that script).

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** The extensions `pnpm run lint` formats and lints in every workspace (its oxfmt glob). */
export const LINTED_EXTENSIONS = ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"];

/** The lint-staged glob for {@link LINTED_EXTENSIONS}. */
export const LINTED_GLOB = `*.{${LINTED_EXTENSIONS.join(",")}}`;

/**
 * The workspace that lints `file`: the nearest folder above it, below
 * `repoRoot`, whose package.json has a `lint` script. `undefined` when none
 * does (the repository root's own `lint` only runs Turborepo).
 *
 * @param {string} repoRoot absolute
 * @param {string} file absolute
 * @param {(packageJsonPath: string) => boolean} [hasLintScript]
 * @returns {string | undefined}
 */
export function owningWorkspace(repoRoot, file, hasLintScript = packageHasLintScript) {
	let directory = path.dirname(file);
	while (directory.startsWith(`${repoRoot}${path.sep}`)) {
		if (hasLintScript(path.join(directory, "package.json"))) {
			return directory;
		}
		directory = path.dirname(directory);
	}
	return undefined;
}

/**
 * @param {string} packageJsonPath
 * @returns {boolean}
 */
function packageHasLintScript(packageJsonPath) {
	if (!existsSync(packageJsonPath)) {
		return false;
	}
	const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));
	return manifest.scripts?.lint !== undefined;
}

/**
 * @param {string} value
 * @returns {string}
 */
function quoted(value) {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** The runner every command starts (repo-relative). */
export const RUN_IN_WORKSPACE = "packages/tooling/scripts/run-in-workspace.mjs";

/**
 * The commands for `files` (absolute paths): per owning workspace, in the
 * order first seen, its oxfmt (writing) and then its oxlint, on that
 * workspace's files only. Files no workspace lints are left alone. Commands
 * run from `repoRoot` (lint-staged's working directory under the hook).
 *
 * @param {string} repoRoot absolute
 * @param {readonly string[]} files absolute
 * @param {(file: string) => string | undefined} [workspaceOf]
 * @returns {string[]}
 */
export function stagedLintCommands(repoRoot, files, workspaceOf = (file) => owningWorkspace(repoRoot, file)) {
	/** @type {Map<string, string[]>} */
	const byWorkspace = new Map();
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
