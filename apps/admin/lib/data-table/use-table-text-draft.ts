"use client";

import { trimUrlDraft, useUrlDraft, type UrlDraft } from "@workspace/client/lib/url-state/use-url-draft";

/** Debounce before a table's search box / free-text filter is written to the URL. */
export const TABLE_TEXT_DEBOUNCE_MS = 300;

/**
 * The in-progress text of a table's search box or free-text filter whose
 * committed value lives in the URL (`value`, `undefined` when absent). The
 * draft is committed — trimmed — after {@link TABLE_TEXT_DEBOUNCE_MS}; `onCommit`
 * should write it with `{ history: "replace" }` and reset to page 1.
 */
export function useTableTextDraft(value: string | undefined, onCommit: (value: string) => void): UrlDraft {
	return useUrlDraft({ value: value ?? "", onCommit, delayMs: TABLE_TEXT_DEBOUNCE_MS, normalize: trimUrlDraft });
}
