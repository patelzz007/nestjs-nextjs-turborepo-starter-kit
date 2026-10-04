"use client";

// ============================================
// lib/url-state/use-url-draft.ts - a text input whose committed value lives in the URL
// ============================================
// A search box (or free-text filter) has two values: what the user is typing
// right now, and what the URL holds. Only the second is shareable state; the
// first is a legitimately local, in-progress DRAFT. This hook keeps the draft
// in `useState`, commits it to the URL after `delayMs` of inactivity, and
// resets it whenever the URL value changes from the outside (back/forward, a
// "clear filters" button, a shared link) — so the box always shows what the
// URL says once the user stops typing.
//
// The commit is tracked as "pending" until the URL echoes it back, so the
// render that happens between the commit and the router's update can never
// throw away characters typed in the meantime.

import { useDebouncedDraft } from "@workspace/ui/hooks/use-debounced-draft";

export interface UrlDraftOptions {
	/** The committed value as the URL holds it (`""` when the param is absent). */
	readonly value: string;
	/** Writes a draft to the URL (typically `update({ search, page: 1 }, { history: "replace" })`). Keep it stable (`useCallback`). */
	readonly onCommit: (value: string) => void;
	/** Debounce before a draft is committed. */
	readonly delayMs: number;
	/**
	 * How the URL will store a draft (e.g. trimmed), so a draft that only
	 * differs by surrounding whitespace is not committed again and is not reset
	 * when its normalized echo comes back. Keep it stable (module-level). Defaults to identity.
	 */
	readonly normalize?: (draft: string) => string;
}

/** `[draft, setDraft]` — bind them to the input's `value` / `onChange`. */
export type UrlDraft = readonly [string, (draft: string) => void];

/** Trims a draft — the normalization of trimmed URL params (`listSearchParam`, `listTextFilterParam`). */
export function trimUrlDraft(draft: string): string {
	return draft.trim();
}

/** The shared debounced-draft behaviour (`useDebouncedDraft`) with the URL as the committed value's owner. */
export function useUrlDraft(options: UrlDraftOptions): UrlDraft {
	const { draft, setDraft } = useDebouncedDraft(options);
	return [draft, setDraft];
}
