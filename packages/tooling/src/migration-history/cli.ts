#!/usr/bin/env node
/**
 * Fails when committed Prisma migrations were edited, deleted, renamed or
 * extended, or when a new migration is not strictly newer than every committed
 * one (rules in migration-history.ts). Migrations older than the
 * baseline in apps/api/prisma/migrations-baseline.json are ignored; moving that
 * baseline forward is the only way to drop history and prints a notice.
 *
 *   node packages/tooling/src/migration-history/cli.ts --base origin/main
 *   node packages/tooling/src/migration-history/cli.ts --base origin/main --working-tree
 *
 * --base          ref to compare against; the merge base of <ref> and HEAD is used
 * --working-tree  also include uncommitted and untracked files (local runs)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseMigrationBaseline } from "./migration-baseline.ts";
import { checkMigrationHistory, parseNameStatus } from "./migration-history.ts";
import { settings } from "../shared/settings.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const MIGRATIONS_DIR = settings.migrations.directory;
const BASELINE_FILE = settings.migrations.baselineFile;
const MIGRATIONS_PREFIX = `${MIGRATIONS_DIR}/`;

function git(args: readonly string[]): string {
	return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** Directory names under the migrations dir at a commit. */
function directoriesAt(ref: string): string[] {
	return git(["ls-tree", "-d", "--name-only", `${ref}:${MIGRATIONS_DIR}`])
		.split("\n")
		.filter((name) => name.length > 0);
}

/** A file's content at a commit, or null when it does not exist there. */
function fileAt(ref: string, file: string): string | null {
	const listed = git(["ls-tree", "--name-only", ref, "--", file]).trim();
	return listed.length === 0 ? null : git(["show", `${ref}:${file}`]);
}

function parseArgs(argv: readonly string[]): { base: string; includeWorkingTree: boolean } {
	const baseIndex = argv.indexOf("--base");
	const base = baseIndex === -1 ? undefined : argv[baseIndex + 1];
	if (base === undefined || base.startsWith("--")) {
		throw new Error("missing --base <ref> (e.g. origin/main)");
	}
	return { base, includeWorkingTree: argv.includes("--working-tree") };
}

function main(): void {
	const { base, includeWorkingTree } = parseArgs(process.argv.slice(2));
	const mergeBase = git(["merge-base", base, "HEAD"]).trim();

	const baseDirectories = directoriesAt(mergeBase);
	const baseBaseline = parseMigrationBaseline(fileAt(mergeBase, BASELINE_FILE), `${BASELINE_FILE} at the merge base`);

	const headDirectories = includeWorkingTree
		? readdirSync(path.join(REPO_ROOT, MIGRATIONS_DIR), { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
		: directoriesAt("HEAD");
	const headMarkerPath = path.join(REPO_ROOT, BASELINE_FILE);
	const headMarkerText = includeWorkingTree ? (existsSync(headMarkerPath) ? readFileSync(headMarkerPath, "utf8") : null) : fileAt("HEAD", BASELINE_FILE);
	const headBaseline = parseMigrationBaseline(headMarkerText, BASELINE_FILE);

	// Compare the merge base with HEAD, or with the working tree for local runs.
	const diffTarget = includeWorkingTree ? [mergeBase] : [mergeBase, "HEAD"];
	const changes = parseNameStatus(git(["diff", "--name-status", "--no-renames", ...diffTarget, "--", MIGRATIONS_DIR]), MIGRATIONS_PREFIX);
	if (includeWorkingTree) {
		const untracked = git(["ls-files", "--others", "--exclude-standard", "--", MIGRATIONS_DIR])
			.split("\n")
			.filter((file) => file.length > 0)
			.map((file) => `A\t${file}`)
			.join("\n");
		changes.push(...parseNameStatus(untracked, MIGRATIONS_PREFIX));
	}

	const { violations, notices } = checkMigrationHistory({ baseDirectories, headDirectories, changes, baseBaseline, headBaseline });
	for (const notice of notices) {
		// A GitHub Actions warning annotation, so the move is visible on the PR.
		process.stdout.write(`::warning title=Migration baseline moved::${notice}\n`);
	}
	if (violations.length === 0) {
		const baselineNote = headBaseline === null ? "no baseline" : `baseline ${headBaseline.baseline}`;
		process.stdout.write(
			`Migration history intact against ${base} (merge base ${mergeBase.slice(0, 12)}, ${baselineNote}): ${String(changes.length)} changed file(s), no committed migration changed.\n`,
		);
		return;
	}

	process.stderr.write(`Migration history check failed against ${base} (merge base ${mergeBase.slice(0, 12)}):\n`);
	for (const violation of violations) {
		process.stderr.write(`  - ${MIGRATIONS_PREFIX}${violation.path}: ${violation.reason}\n`);
	}
	process.stderr.write("Committed migrations are immutable. Revert the change and add a NEW forward migration: pnpm db:migrate:create --name <change>\n");
	process.exitCode = 1;
}

try {
	main();
} catch (error) {
	process.stderr.write(`check-migration-history failed: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
}
