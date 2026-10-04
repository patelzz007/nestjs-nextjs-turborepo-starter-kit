"use client";

import type { UrlDraft } from "./use-url-draft";
import * as React from "react";

/**
 * The text of a search box that commits on SUBMIT (not while typing), whose
 * committed value lives in the URL (`value`, `undefined` when absent).
 *
 * The draft is legitimately local, in-progress input. Whenever the URL value
 * changes — the submit echoing back, back/forward, "Clear filters", a shared
 * link — the box resets to what the URL now says, so it can never show a
 * search the results do not reflect. For a box that commits while typing, use
 * `useUrlDraft` (debounced) instead.
 */
export function useSubmittedUrlDraft(value: string | undefined): UrlDraft {
	const committed: string = value ?? "";
	const [draft, setDraftState] = React.useState<string>(committed);
	const [synced, setSynced] = React.useState<string>(committed);

	// Adjusting state while rendering (not in an effect): the reset lands in
	// the same render as the URL change, with no frame showing the stale draft.
	if (committed !== synced) {
		setSynced(committed);
		setDraftState(committed);
	}

	const setDraft = React.useCallback((next: string): void => {
		setDraftState(next);
	}, []);

	return [draft, setDraft];
}
