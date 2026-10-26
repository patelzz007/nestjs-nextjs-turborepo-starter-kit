"use client";

import type { UrlDraft } from "./use-url-draft";
import * as React from "react";

import { useHistoryTraversalCount } from "./use-history-traversal";

/** What the draft last agreed with: the committed value and the history traversal it was on. */
interface DraftSync {
	readonly value: string;
	readonly traversals: number;
}

/**
 * The text of a search box that commits on SUBMIT (not while typing), whose
 * committed value lives in the URL (`value`, `undefined` when absent).
 *
 * The draft is legitimately local, in-progress input. Whenever the URL value
 * changes — the submit echoing back, "Clear filters", a shared link — and on
 * every Back / Forward, the box resets to what the URL says, so it can never
 * show a search the results do not reflect. A traversal resets it even when
 * the committed value did not change: a Back pressed before the router
 * committed the submitted search lands on the value React already shows
 * (use-history-traversal.ts). For a box that commits while typing, use
 * `useUrlDraft` (debounced) instead.
 */
export function useSubmittedUrlDraft(value: string | undefined): UrlDraft {
	const committed: string = value ?? "";
	const traversals: number = useHistoryTraversalCount();
	const [draft, setDraftState] = React.useState<string>(committed);
	const [synced, setSynced] = React.useState<DraftSync>({ value: committed, traversals });

	// Adjusting state while rendering (not in an effect): the reset lands in
	// the same render as the URL change, with no frame showing the stale draft.
	if (committed !== synced.value || traversals !== synced.traversals) {
		setSynced({ value: committed, traversals });
		setDraftState(committed);
	}

	const setDraft = React.useCallback((next: string): void => {
		setDraftState(next);
	}, []);

	return [draft, setDraft];
}
