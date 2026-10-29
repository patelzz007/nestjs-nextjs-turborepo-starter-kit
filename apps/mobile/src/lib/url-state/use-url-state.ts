// ============================================
// lib/url-state/use-url-state.ts - read/write a URL state from a screen
// ============================================
// The mobile twin of the web's `@workspace/client/lib/url-state` (rules/03, "URL state"): the same
// codec (`defineUrlState` from @workspace/shared) and the same `[state, update]` hook, so a screen's
// URL state reads the same on both platforms. Screens never import nuqs.
//
// `useUrlState(codec)` returns `[state, update]`:
//   - `state` is the codec's zod parse of the screen's search params, so it is correct on a deep
//     link and whenever the params change — there is no copy to keep in sync.
//   - `update(patch)` merges `patch` into the CURRENT URL state and writes the result back to the
//     screen's params.
//
// The engine is nuqs (`useQueryStates`, mounted by `UrlStateProvider` on Expo Router):
//   - An update changes `state` in the SAME render as the press that caused it — every hook reading
//     those keys re-renders at once — and the route's params follow on the next tick.
//   - Several updates in the same tick (a filter change followed by "back to page 1") are applied on
//     top of each other (the updater sees the queued values), then written as one change.
//
// History: on the web, `"push"` adds a browser history entry and `"replace"` overwrites it. Expo
// Router has no shallow history push, so on a phone both write the screen's params in place — the
// back button leaves the screen, as people expect, instead of stepping back through its pages. The
// option is kept so a screen's code reads the same as its web twin's. The web version's Back/Forward
// address-bar sync has no counterpart here: a phone has no address bar.

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
import { parseAsString, useQueryStates } from "nuqs";
import * as React from "react";

/** `[state, update]` for one URL state declared with `defineUrlState`. */
export function useUrlState<TShape extends UrlStateShape>(codec: UrlStateCodec<TShape>): readonly [UrlState<TShape>, UrlStateUpdate<UrlState<TShape>>] {
	// One raw string parser per owned key: the codec, not nuqs, decides what a value means.
	const rawParsers = React.useMemo(() => Object.fromEntries(codec.urlKeys.map((key: string) => [key, parseAsString])), [codec]);
	const [raw, setRaw] = useQueryStates(rawParsers);
	const state: UrlState<TShape> = React.useMemo((): UrlState<TShape> => codec.parse(rawUrlParamsToSearch(raw)), [codec, raw]);
	const update = React.useCallback(
		(patch: Partial<UrlState<TShape>>, options?: UrlStateUpdateOptions): void => {
			void setRaw(
				(current: RawUrlParams): RawUrlParams => {
					const next: RawUrlParams = urlStateToRawParams(codec, { ...codec.parse(rawUrlParamsToSearch(current)), ...patch });
					// Nothing to write.
					return isSameRawUrlParams(current, next) ? {} : next;
				},
				{ history: options?.history ?? "push" },
			);
		},
		[codec, setRaw],
	);
	return [state, update];
}
