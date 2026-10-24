import type { KanbanSearchMatch } from "@workspace/shared";

/** An item as the ranking reads it. */
export interface KanbanSearchCandidate {
	readonly id: string;
	readonly key: string | null;
	readonly title: string;
}

/** A candidate and how it matched the text. */
export interface KanbanRankedCandidate<TCandidate extends KanbanSearchCandidate> {
	readonly candidate: TCandidate;
	readonly match: KanbanSearchMatch;
}

/** Best first. */
const MATCH_RANK: Readonly<Record<KanbanSearchMatch, number>> = { KEY: 0, KEY_PREFIX: 1, TITLE: 2 };

/** How `candidate` matches `text`, ignoring case — the best way it does — or `null` when it does not. */
export function matchOf(candidate: KanbanSearchCandidate, text: string): KanbanSearchMatch | null {
	const needle = text.trim().toUpperCase();
	const key = candidate.key?.toUpperCase() ?? null;
	if (key === needle) {
		return "KEY";
	}
	if (key?.startsWith(needle) === true) {
		return "KEY_PREFIX";
	}
	return candidate.title.toUpperCase().includes(needle) ? "TITLE" : null;
}

/**
 * The candidates that match `text`, best first: the exact key, then keys that
 * start with it, then titles that contain it; within one kind of match the
 * candidates keep the order they came in (the reads hand them over in creation
 * order). Each item once, at most `limit`.
 */
export function rankSearchCandidates<TCandidate extends KanbanSearchCandidate>(
	candidates: readonly TCandidate[],
	text: string,
	limit: number,
): readonly KanbanRankedCandidate<TCandidate>[] {
	const seen = new Set<string>();
	const ranked: KanbanRankedCandidate<TCandidate>[] = [];
	for (const candidate of candidates) {
		const match = matchOf(candidate, text);
		if (match !== null && !seen.has(candidate.id)) {
			seen.add(candidate.id);
			ranked.push({ candidate, match });
		}
	}
	// `sort` is stable, so equal matches keep their incoming order.
	return ranked.sort((left, right) => MATCH_RANK[left.match] - MATCH_RANK[right.match]).slice(0, limit);
}
