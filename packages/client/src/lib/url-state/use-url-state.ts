"use client";

// ============================================
// lib/url-state/use-url-state.ts - read/write a URL state from a client component
// ============================================
// `useUrlState(codec)` returns `[state, update]`:
//   - `state` is parsed from `useSearchParams()` with the codec, so it is
//     correct during SSR of a dynamic page, after a reload, on a shared link
//     and after browser back/forward — there is no copy to keep in sync.
//   - `update(patch, { history })` merges `patch` into the CURRENT URL state
//     and writes the result back to the address bar.
//
// Writing uses the native History API (`history.pushState` /
// `history.replaceState`), which Next.js integrates with its router: it keeps
// `useSearchParams()` / `usePathname()` in sync and back/forward restores the
// entry — WITHOUT a server round trip. `router.push`/`router.replace` would
// instead re-render the page's server components on every change (refetching
// the server-prefetched page, waiting for the RSC payload before the URL and
// the table update, and showing the route's `loading.tsx`). Table rows are
// TanStack Query's job; the server page only renders the first request.
//
// History policy (docs/technical/api/list-queries.md §7):
//   - "push" (default) for discrete navigation — page, page size, sort,
//     filter selects, an in-page selection. Back undoes it.
//   - "replace" for continuous input committed while the user types (the
//     debounced search box, free-text filters — see `useUrlDraft`), so history
//     is not flooded with one entry per keystroke.

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { isSameQuery, type UrlState, type UrlStateCodec, type UrlStateShape } from "./url-state";

/** How an update is recorded in browser history. */
export type UrlHistoryMode = "push" | "replace";

export interface UrlStateUpdateOptions {
	/** `"push"` (default) adds a history entry; `"replace"` overwrites the current one. */
	readonly history?: UrlHistoryMode;
}

/** Merges `patch` into the current URL state and navigates; a patch that changes nothing is a no-op. */
export type UrlStateUpdate<TState> = (patch: Partial<TState>, options?: UrlStateUpdateOptions) => void;

/**
 * Applies `patch` to the URL the browser is on NOW (not the one this render
 * saw), so several updates in the same tick — e.g. a filter change followed by
 * the table's own "back to page 1" — compose instead of overwriting each other.
 */
function writeUrlState<TShape extends UrlStateShape>(codec: UrlStateCodec<TShape>, patch: Partial<UrlState<TShape>>, options: UrlStateUpdateOptions | undefined): void {
	const current = new URLSearchParams(window.location.search);
	const query: string = codec.serialize({ ...codec.parse(current), ...patch }, current);
	if (isSameQuery(query, current.toString())) {
		return;
	}
	const href = `${window.location.pathname}${query.length > 0 ? `?${query}` : ""}${window.location.hash}`;
	if (options?.history === "replace") {
		window.history.replaceState(null, "", href);
		return;
	}
	window.history.pushState(null, "", href);
}

/** `[state, update]` for one URL state declared with `defineUrlState`. */
export function useUrlState<TShape extends UrlStateShape>(codec: UrlStateCodec<TShape>): readonly [UrlState<TShape>, UrlStateUpdate<UrlState<TShape>>] {
	const searchParams = useSearchParams();
	const state: UrlState<TShape> = useMemo((): UrlState<TShape> => codec.parse(searchParams), [codec, searchParams]);
	const update = useCallback(
		(patch: Partial<UrlState<TShape>>, options?: UrlStateUpdateOptions): void => {
			writeUrlState(codec, patch, options);
		},
		[codec],
	);
	return [state, update];
}
