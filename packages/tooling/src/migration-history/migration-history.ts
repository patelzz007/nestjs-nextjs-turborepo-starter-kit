/**
 * Pure rules behind `src/migration-history/cli.ts`: committed Prisma migrations
 * are immutable history. Relative to the merge base, a change may only ADD a
 * NEW migration directory whose name sorts after every kept one and whose
 * timestamp prefix is unique. Editing, deleting, renaming or adding files to a
 * committed migration is rejected (an applied migration's checksum would no
 * longer match, and environments that already ran it would silently diverge).
 *
 * Explicit baseline (migration-baseline.ts): migrations older than the
 * baseline are ignored. Moving the baseline forward — to a migration that
 * exists after the change — is the ONLY way to drop history: in that same
 * diff, migrations between the old and the new baseline may be deleted (only
 * deleted), and the result carries a notice so reviewers see it happened.
 */

/** Prisma migration directory names start with a 14-digit UTC timestamp (YYYYMMDDHHMMSS). */
const MIGRATION_TIMESTAMP_PATTERN = /^(\d{14})_[a-z0-9_]+$/;

/** git `--name-status` entry, path relative to the migrations dir */
export interface FileChange {
	status: string;
	path: string;
}
export interface Violation {
	path: string;
	reason: string;
}
export interface Baseline {
	baseline: string;
	reason: string;
	since: string;
}
export interface HistoryCheck {
	violations: Violation[];
	notices: string[];
}

/** Path label used for violations about the marker itself. */
export const BASELINE_MARKER_LABEL = "../migrations-baseline.json";

/** The migration directory a path belongs to, or null for a top-level file (e.g. migration_lock.toml). */
function migrationDirectoryOf(relativePath: string): string | null {
	const separatorIndex = relativePath.indexOf("/");
	return separatorIndex === -1 ? null : relativePath.slice(0, separatorIndex);
}

/** Checks the marker transition; returns whether the baseline moved forward in this diff. */
function checkBaselineTransition(
	{
		baseBaseline,
		headBaseline,
		headDirectories,
	}: { readonly baseBaseline: Baseline | null; readonly headBaseline: Baseline | null; readonly headDirectories: readonly string[] },
	violations: Violation[],
): boolean {
	if (headBaseline === null) {
		if (baseBaseline !== null) {
			violations.push({ path: BASELINE_MARKER_LABEL, reason: `the baseline marker was removed (it named ${baseBaseline.baseline}); a baseline can only move forward` });
		}
		return false;
	}
	if (!headDirectories.includes(headBaseline.baseline)) {
		violations.push({ path: BASELINE_MARKER_LABEL, reason: `baseline ${headBaseline.baseline} is not an existing migration directory` });
	}
	if (baseBaseline === null) {
		return true;
	}
	if (headBaseline.baseline < baseBaseline.baseline) {
		violations.push({ path: BASELINE_MARKER_LABEL, reason: `the baseline moved backwards (${baseBaseline.baseline} → ${headBaseline.baseline}); it can only move forward` });
		return false;
	}
	return headBaseline.baseline !== baseBaseline.baseline;
}

export function checkMigrationHistory({
	baseDirectories,
	headDirectories,
	changes,
	baseBaseline,
	headBaseline,
}: {
	baseDirectories: readonly string[];
	headDirectories: readonly string[];
	changes: readonly FileChange[];
	baseBaseline: Baseline | null;
	headBaseline: Baseline | null;
}): HistoryCheck {
	const violations: Violation[] = [];
	const notices = [];
	const moved = checkBaselineTransition({ baseBaseline, headBaseline, headDirectories }, violations);
	const isPreBaseline = (directory: string, marker: Baseline | null): boolean => marker !== null && directory < marker.baseline;

	const existing = new Set(baseDirectories);
	const newDirectories = new Set<string>();
	const dropped = new Set();

	for (const change of changes) {
		const directory = migrationDirectoryOf(change.path);
		const isAddition = change.status === "A";

		if (directory === null) {
			// migration_lock.toml (provider lock) and any other top-level file.
			if (!isAddition) {
				violations.push({ path: change.path, reason: `top-level migrations file changed (git status ${change.status}); the provider lock is fixed history` });
			}
			continue;
		}
		if (existing.has(directory)) {
			if (isPreBaseline(directory, baseBaseline)) {
				continue; // already outside history at the merge base
			}
			if (moved && isPreBaseline(directory, headBaseline)) {
				if (change.status === "D") {
					dropped.add(directory);
				} else {
					violations.push({ path: change.path, reason: "a migration dropped by moving the baseline may only be deleted, never edited" });
				}
				continue;
			}
			violations.push({
				path: change.path,
				reason: isAddition
					? "file added to an already committed migration"
					: `committed migration ${describeStatus(change.status)}${change.status === "D" ? " (history can only be dropped by moving the baseline forward — see docs/technical/operations/ci.md)" : ""}`,
			});
			continue;
		}
		if (!isAddition) {
			violations.push({ path: change.path, reason: `unexpected git status ${change.status} for a new migration` });
			continue;
		}
		newDirectories.add(directory);
	}

	// Committed migrations that remain history after this change.
	const kept = [...existing].filter((directory) => !isPreBaseline(directory, baseBaseline) && !isPreBaseline(directory, headBaseline)).sort();
	const latestKept = kept.at(-1);
	const seenPrefixes = new Map(kept.map((directory) => [timestampOf(directory), directory]));
	for (const directory of [...newDirectories].sort()) {
		const timestamp = timestampOf(directory);
		if (timestamp === null) {
			violations.push({ path: directory, reason: "new migration name must be <14-digit UTC timestamp>_<snake_case_name> (use `pnpm db:migrate:create`)" });
			continue;
		}
		if (isPreBaseline(directory, headBaseline)) {
			violations.push({ path: directory, reason: `new migration is older than the baseline (${headBaseline?.baseline ?? ""}) and would never be checked` });
		}
		if (latestKept !== undefined && directory <= latestKept) {
			violations.push({
				path: directory,
				reason: `new migration sorts before the latest committed one (${latestKept}); migrations are forward-only — regenerate it with a current timestamp`,
			});
		}
		const clash = seenPrefixes.get(timestamp);
		if (clash !== undefined) {
			violations.push({ path: directory, reason: `timestamp prefix ${timestamp} is already used by ${clash}` });
		}
		seenPrefixes.set(timestamp, directory);
	}

	if (moved && headBaseline !== null) {
		const droppedList = [...dropped].sort();
		notices.push(
			`MIGRATION BASELINE MOVED: ${baseBaseline?.baseline ?? "(no baseline)"} → ${headBaseline.baseline} (since ${headBaseline.since}). Reason: ${headBaseline.reason.replace(/\.$/, "")}. ` +
				`History dropped in this change: ${droppedList.length === 0 ? "none" : droppedList.join(", ")}. ` +
				"Only acceptable if no shared or deployed database ran the dropped migrations.",
		);
	}

	return { violations, notices };
}

function timestampOf(directory: string): string | null {
	return MIGRATION_TIMESTAMP_PATTERN.exec(directory)?.at(1) ?? null;
}

function describeStatus(status: string): string {
	if (status === "D") {
		return "deleted";
	}
	if (status === "M") {
		return "modified";
	}
	if (status.startsWith("R")) {
		return "renamed";
	}
	return `changed (git status ${status})`;
}

/**
 * Parses `git diff --name-status --no-renames` text output (one
 * `STATUS<TAB>path` per line) into changes relative to `migrationsPrefix`.
 * @param migrationsPrefix e.g. "apps/api/prisma/migrations/"
 */

export function parseNameStatus(output: string, migrationsPrefix: string): FileChange[] {
	return output
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => {
			const [status, ...paths] = line.split("\t");
			return { status: status ?? "", path: paths.at(-1) ?? "" };
		})
		.filter((change) => change.path.startsWith(migrationsPrefix))
		.map((change) => ({ status: change.status, path: change.path.slice(migrationsPrefix.length) }));
}
