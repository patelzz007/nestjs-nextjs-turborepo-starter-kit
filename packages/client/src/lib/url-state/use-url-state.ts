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

import type { UrlState, UrlStateCodec, UrlStateShape } from "./url-state";

import { useHistoryTraversalCount } from "./use-history-traversal";

/** How an update is recorded in browser history. */
export type UrlHistoryMode = "push" | "replace";

export interface UrlStateUpdateOptions {
	/** `"push"` (default) adds a history entry; `"replace"` overwrites the current one. */
	readonly history?: UrlHistoryMode;
}

/** Merges `patch` into the current URL state and navigates; a patch that changes nothing is a no-op. */
export type UrlStateUpdate<TState> = (patch: Partial<TState>, options?: UrlStateUpdateOptions) => void;

/** Each URL key a codec owns → its raw value (`null` when absent). */
export type RawUrlParams = Readonly<Record<string, string | null>>;

/** The raw values as search params (absent keys left out), for `codec.parse`. */
export function rawUrlParamsToSearch(raw: RawUrlParams): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(raw)) {
		if (value !== null) {
			params.set(key, value);
		}
	}
	return params;
}

/** `state` as the raw value of each URL key the codec owns (`null` for a param serialized away as its default). */
export function urlStateToRawParams<TShape extends UrlStateShape>(codec: UrlStateCodec<TShape>, state: UrlState<TShape>): RawUrlParams {
	const params = new URLSearchParams(codec.serialize(state));
	return Object.fromEntries(codec.urlKeys.map((key: string): [string, string | null] => [key, params.get(key)]));
}

/** The two raw value sets carry the same value for every key of `next`. */
export function isSameRawUrlParams(current: RawUrlParams, next: RawUrlParams): boolean {
	return Object.entries(next).every(([key, value]): boolean => (current[key] ?? null) === value);
}

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
