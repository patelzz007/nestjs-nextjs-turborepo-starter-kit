// Reading a commit's diffs for the commit screen: a file's unified patch into
// numbered lines (GitHub sends hunks only, no `diff --git` header), GitHub's
// five-square diffstat, and which files open expanded. Pure, so tested without
// rendering.

import type { GithubCommitFile } from "@workspace/shared";
import { z } from "zod";

import type { DiffStatBlocks } from "../../components/diff-stat";
import type { DiffLine } from "../../components/diff-view";

/** `@@ -10,6 +10,8 @@ function name` — where a hunk starts in the old and the new file. */
const HUNK_HEADER_PATTERN = /^@@ -(?<oldStart>\d+)(?:,\d+)? \+(?<newStart>\d+)(?:,\d+)? @@/;

const HunkStartSchema = z.object({ oldStart: z.coerce.number().int().nonnegative(), newStart: z.coerce.number().int().nonnegative() });

const LINE_BREAK = "\n";
const ADDITION_MARKER = "+";
const DELETION_MARKER = "-";
/** git's "\ No newline at end of file", after the line it is about. */
const NOTE_MARKER = "\\";
const NOTE_PREFIX = "\\ ";

/** Where the next line of each side is numbered from. */
interface Cursor {
	readonly oldNumber: number;
	readonly newNumber: number;
}

/**
 * A patch's lines with the number each has in the old and the new file. A
 * line before any hunk header (GitHub never sends one) is numbered from 1.
 */
export function parsePatch(patch: string): DiffLine[] {
	const rows = patch.split(LINE_BREAK);
	// A trailing line break leaves one empty row that is not a line of the file.
	const lastRow = rows.at(-1);
	const content = lastRow === "" ? rows.slice(0, -1) : rows;
	const lines: DiffLine[] = [];
	let cursor: Cursor = { oldNumber: 1, newNumber: 1 };
	for (const row of content) {
		const hunk = HunkStartSchema.safeParse(HUNK_HEADER_PATTERN.exec(row)?.groups);
		if (hunk.success) {
			cursor = { oldNumber: hunk.data.oldStart, newNumber: hunk.data.newStart };
			lines.push({ key: `hunk:${String(cursor.oldNumber)}:${String(cursor.newNumber)}`, kind: "hunk", oldNumber: null, newNumber: null, text: row });
			continue;
		}
		const [previous] = lines.slice(-1);
		if (row.startsWith(NOTE_MARKER)) {
			lines.push({
				key: `note:${previous?.key ?? "start"}`,
				kind: "note",
				oldNumber: null,
				newNumber: null,
				text: row.startsWith(NOTE_PREFIX) ? row.slice(NOTE_PREFIX.length) : row.slice(NOTE_MARKER.length),
			});
			continue;
		}
		const code = row.slice(1);
		if (row.startsWith(ADDITION_MARKER)) {
			lines.push({ key: `+:${String(cursor.newNumber)}`, kind: "addition", oldNumber: null, newNumber: cursor.newNumber, text: code });
			cursor = { ...cursor, newNumber: cursor.newNumber + 1 };
			continue;
		}
		if (row.startsWith(DELETION_MARKER)) {
			lines.push({ key: `-:${String(cursor.oldNumber)}`, kind: "deletion", oldNumber: cursor.oldNumber, newNumber: null, text: code });
			cursor = { ...cursor, oldNumber: cursor.oldNumber + 1 };
			continue;
		}
		lines.push({ key: `=:${String(cursor.oldNumber)}:${String(cursor.newNumber)}`, kind: "context", oldNumber: cursor.oldNumber, newNumber: cursor.newNumber, text: code });
		cursor = { oldNumber: cursor.oldNumber + 1, newNumber: cursor.newNumber + 1 };
	}
	return lines;
}

/** GitHub's diffstat always has this many squares. */
export const DIFF_STAT_SQUARES = 5;

/**
 * How many of the five squares are green, red and grey. A small change fills
 * one square per line (+2 −1 → two green, one red, two grey); a larger one
 * splits all five by share, and each side that changed keeps at least one.
 */
export function diffStatBlocks(additions: number, deletions: number): DiffStatBlocks {
	const total = additions + deletions;
	if (total === 0) {
		return { added: 0, deleted: 0, unchanged: DIFF_STAT_SQUARES };
	}
	const filled = Math.min(total, DIFF_STAT_SQUARES);
	const share = Math.round((additions / total) * filled);
	const atLeastOne = additions > 0 ? Math.max(share, 1) : 0;
	const added = deletions > 0 ? Math.min(atLeastOne, filled - 1) : filled;
	return { added, deleted: filled - added, unchanged: DIFF_STAT_SQUARES - filled };
}

/** A file whose diff is longer than this opens collapsed, like GitHub's "Load diff". */
export const FILE_AUTO_EXPAND_LINES = 200;

/** Files open expanded, in order, until their diffs reach this many lines together; the rest open collapsed. */
export const COMMIT_AUTO_EXPAND_LINES = 600;

/** Lines of a file's diff; 0 when there is none to show. */
export function diffLineCount(file: GithubCommitFile): number {
	return file.diff.kind === "patch" ? file.diff.patch.split(LINE_BREAK).length : 0;
}

/**
 * The paths that open expanded: each file with a diff short enough, in order,
 * while the expanded diffs stay within {@link COMMIT_AUTO_EXPAND_LINES} lines —
 * so a large commit renders a bounded number of lines until the person asks.
 */
export function initiallyExpandedPaths(files: readonly GithubCommitFile[]): ReadonlySet<string> {
	const expanded = new Set<string>();
	let shownLines = 0;
	for (const file of files) {
		const lines = diffLineCount(file);
		if (lines > 0 && lines <= FILE_AUTO_EXPAND_LINES && shownLines + lines <= COMMIT_AUTO_EXPAND_LINES) {
			expanded.add(file.path);
			shownLines += lines;
		}
	}
	return expanded;
}
