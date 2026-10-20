// Where a file's line-comment threads go inside its diff, the way GitHub's app
// places them: right under the line they are on — a `right` thread on the new
// file's line, a `left` thread on the old file's. A thread whose line is not
// in the diff shown (outdated, or outside these hunks) is listed with the
// file, before or after the diff. Pure.

import type { GithubReviewThread } from "@workspace/shared";

import type { DiffLine } from "../../../components/diff-view";

/** A run of diff lines, or the threads that follow the last of them. */
export type DiffSegment =
	| { readonly kind: "lines"; readonly key: string; readonly lines: readonly DiffLine[] }
	| { readonly kind: "threads"; readonly key: string; readonly threads: readonly GithubReviewThread[] };

/** One file's diff with its threads woven in, and the threads that have no line in it. */
export interface ThreadedDiff {
	/** Outdated threads (their line changed since): shown above the diff. */
	readonly outdated: readonly GithubReviewThread[];
	readonly segments: readonly DiffSegment[];
	/** Threads on lines this diff does not show: shown below it. */
	readonly unplaced: readonly GithubReviewThread[];
}

/** The thread's anchor in a diff: which side, which line number. */
function anchorOf(line: DiffLine): readonly string[] {
	const anchors: string[] = [];
	if (line.newNumber !== null && line.kind !== "deletion") {
		anchors.push(`right:${String(line.newNumber)}`);
	}
	if (line.oldNumber !== null && line.kind !== "addition") {
		anchors.push(`left:${String(line.oldNumber)}`);
	}
	return anchors;
}

function threadAnchor(thread: GithubReviewThread): string | null {
	return thread.line === null ? null : `${thread.side}:${String(thread.line)}`;
}

/** `lines` cut after every line that has threads, each cut followed by those threads. */
export function threadDiff(lines: readonly DiffLine[], threads: readonly GithubReviewThread[]): ThreadedDiff {
	const outdated = threads.filter((thread: GithubReviewThread): boolean => thread.isOutdated || thread.line === null);
	const byAnchor = new Map<string, GithubReviewThread[]>();
	for (const thread of threads) {
		const anchor = threadAnchor(thread);
		if (anchor !== null && !outdated.includes(thread)) {
			byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), thread]);
		}
	}
	const placed = new Set<GithubReviewThread>();
	const segments: DiffSegment[] = [];
	let run: DiffLine[] = [];
	for (const line of lines) {
		run.push(line);
		const here = anchorOf(line).flatMap((anchor: string): GithubReviewThread[] => byAnchor.get(anchor) ?? []);
		if (here.length > 0) {
			segments.push({ kind: "lines", key: `lines:${line.key}`, lines: run });
			segments.push({ kind: "threads", key: `threads:${line.key}`, threads: here });
			for (const thread of here) {
				placed.add(thread);
			}
			run = [];
		}
	}
	if (run.length > 0) {
		const [first] = run;
		segments.push({ kind: "lines", key: `lines:${first?.key ?? "end"}`, lines: run });
	}
	const unplaced = threads.filter((thread: GithubReviewThread): boolean => !outdated.includes(thread) && !placed.has(thread));
	return { outdated, segments, unplaced };
}
