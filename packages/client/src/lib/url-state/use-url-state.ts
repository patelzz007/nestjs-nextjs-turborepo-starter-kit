"use client";

// ============================================
// lib/url-state/use-url-state.ts - read/write a URL state from a client component
// ============================================
// `useUrlState(codec)` returns `[state, update]`:
//   - `state` is the codec's zod parse of the URL, so it is correct during SSR
//     of a dynamic page, after a reload, on a shared link and after browser
//     back/forward — there is no copy to keep in sync.
//   - `update(patch, { history })` merges `patch` into the CURRENT URL state
//     and writes the result back to the address bar.
//
// The engine is nuqs (`useQueryStates`, mounted by `UrlStateProvider`):
//   - An update changes `state` in the SAME render as the click that caused
//     it — every hook reading those keys re-renders at once — and the URL
//     follows on the next tick (shallow `pushState` / `replaceState`, no server
//     round trip, no `loading.tsx`). Reading `useSearchParams()` instead would
//     lag a router transition behind the click: a tab switch would paint a
//     frame of the old tab's state under the new tab.
//   - Several updates in the same tick — e.g. a filter change followed by the
//     table's own "back to page 1" — are applied on top of each other (the
//     updater sees the queued values), then written as ONE history entry.
//
// Back / Forward re-reads the address bar (`useHistoryTraversalCount`). nuqs
// re-syncs only when the router's value for a key changes; a Back that lands
// after nuqs pushed `?search=x` but before React rendered it returns the router
// to the value it already had, so nuqs would keep showing `x` under a URL
// without it. After every traversal each hook compares its keys with the
// address bar and, where they differ, adopts the address bar's values
// (`replace`: the same entry, nothing added to history).
//
// The codec stays the single declaration of the state (zod per param, used by
// the server page too); nuqs only carries each owned key's raw string.
//
// History policy (docs/technical/api/list-queries.md §7):
//   - "push" (default) for discrete navigation — a tab, page, page size, sort,
//     filter selects, an in-page selection. Back undoes it.
//   - "replace" for continuous input committed while the user types (the
//     debounced search box, free-text filters — see `useUrlDraft`), so history
//     is not flooded with one entry per keystroke.

import { parseAsString, useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";

import {
	isSameRawUrlParams,
	rawUrlParamsToSearch,
	urlStateToRawParams,
	type RawUrlParams,
	type UrlState,
	type UrlStateCodec,
	type UrlStateShape,
	type UrlStateUpdate,
	type UrlStateUpdateOptions,
} from "@workspace/shared";

import { useHistoryTraversalCount } from "./use-history-traversal";

// The update contract and the raw-param helpers are router-free and shared with the mobile app's twin.
export {
	isSameRawUrlParams,
	rawUrlParamsToSearch,
	urlStateToRawParams,
	type RawUrlParams,
	type UrlHistoryMode,
	type UrlStateUpdate,
	type UrlStateUpdateOptions,
} from "@workspace/shared";

/** The raw value of each of `urlKeys` in `search` (a `location.search`), `null` when absent. */
export function rawUrlParamsFromSearch(urlKeys: readonly string[], search: string): RawUrlParams {
	const params = new URLSearchParams(search);
	return Object.fromEntries(urlKeys.map((key: string): [string, string | null] => [key, params.get(key)]));
}

/** `[state, update]` for one URL state declared with `defineUrlState`. */
export function useUrlState<TShape extends UrlStateShape>(codec: UrlStateCodec<TShape>): readonly [UrlState<TShape>, UrlStateUpdate<UrlState<TShape>>] {
	// One raw string parser per owned key: the codec, not nuqs, decides what a value means.
	const rawParsers = useMemo(() => Object.fromEntries(codec.urlKeys.map((key: string) => [key, parseAsString])), [codec]);
	const [raw, setRaw] = useQueryStates(rawParsers);
	const state: UrlState<TShape> = useMemo((): UrlState<TShape> => codec.parse(rawUrlParamsToSearch(raw)), [codec, raw]);
	const traversals: number = useHistoryTraversalCount();
	useEffect((): void => {
		if (traversals === 0) {
			return;
		}
		// After a Back / Forward the address bar is the truth (see the header).
		const addressBar: RawUrlParams = rawUrlParamsFromSearch(codec.urlKeys, window.location.search);
		void setRaw((current: RawUrlParams): RawUrlParams => (isSameRawUrlParams(current, addressBar) ? {} : addressBar), { history: "replace" });
	}, [codec, setRaw, traversals]);
	const update = useCallback(
		(patch: Partial<UrlState<TShape>>, options?: UrlStateUpdateOptions): void => {
			void setRaw(
				(current: RawUrlParams): RawUrlParams => {
					const next: RawUrlParams = urlStateToRawParams(codec, { ...codec.parse(rawUrlParamsToSearch(current)), ...patch });
					// Nothing to write: no history entry either.
					return isSameRawUrlParams(current, next) ? {} : next;
				},
				{ history: options?.history ?? "push" },
			);
		},
		[codec, setRaw],
	);
	return [state, update];
}
