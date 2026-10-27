"use client";

// ============================================
// lib/url-state/use-view-placeholder.ts - never show one view's rows under another
// ============================================
// A list query with `placeholderData: keepPreviousData` keeps its last answer
// on screen while the next one loads. That is right while the list moves
// WITHIN one view — the next page, another sort — and wrong ACROSS views: on a
// tab switch the old tab's rows would show under the new tab until its answer
// arrives, then swap (the flicker of a tab switch). A view is whatever names a
// different dataset (a tab, a status group): pass its key, and while this
// returns `true`, show the view's loading state instead of the rows.

import { useState } from "react";

/** What `useIsOtherViewPlaceholder` needs from a TanStack Query result. */
export interface ViewPlaceholderQuery {
	readonly isSuccess: boolean;
	readonly isPlaceholderData: boolean;
}

/** Whether the data on screen is another view's placeholder (`view` has not been answered yet). */
export function useIsOtherViewPlaceholder(view: string, query: ViewPlaceholderQuery): boolean {
	// The view the shown data was actually fetched for.
	const [answeredView, setAnsweredView] = useState<string>(view);
	if (query.isSuccess && !query.isPlaceholderData && answeredView !== view) {
		setAnsweredView(view);
	}
	return query.isPlaceholderData && answeredView !== view;
}
