// ============================================
// lib/url-state/url-state-provider.tsx - the URL-state engine on Expo Router
// ============================================
// nuqs ships adapters for Next.js, React Router, Remix and TanStack Router, not Expo Router. This is
// that adapter, built on nuqs's custom-adapter API (`nuqs/adapters/custom`): every `useUrlState`
// reads and writes through it. The app mounts `UrlStateProvider` ONCE, in its root layout.
//
// Each hook speaks for the screen it runs in:
//   - reads `useLocalSearchParams()` — that screen's own params, so a screen kept mounted under the
//     next one (a stack) or in another tab never sees someone else's query;
//   - writes with that screen's `navigation.replaceParams`, in place (Expo Router has no shallow
//     history push: see use-url-state.ts). nuqs hands over the screen's whole next query, so the
//     route ends up carrying exactly it: a param the update dropped is gone (`setParams` would merge
//     and leave `?page=undefined` behind), and the route's path params (`[id]`) carry through, since
//     a screen's params are its path params and its query together.
//
// It also hands nuqs the screen's `pathname` and a synchronous snapshot of its params: without them
// nuqs falls back to the browser's `location`, which a phone does not have.

import { toUrlSearchParams } from "@workspace/shared";
import { useLocalSearchParams, useNavigation, usePathname } from "expo-router";
import type { NavigationProp, ParamListBase } from "expo-router/react-navigation";
import { unstable_createAdapterProvider as createAdapterProvider, type unstable_AdapterInterface as AdapterInterface } from "nuqs/adapters/custom";
import * as React from "react";

/** A screen's route params: one value per key, or several for a repeated key. */
export type RouteParams = Readonly<Record<string, string | readonly string[]>>;

/** `search` as the route params that carry exactly it. */
export function routeParamsOf(search: URLSearchParams): RouteParams {
	return Object.fromEntries(
		[...new Set(search.keys())].map((key: string): [string, string | readonly string[]] => {
			const [only, ...more] = search.getAll(key);
			return [key, only !== undefined && more.length === 0 ? only : search.getAll(key)];
		}),
	);
}

/** nuqs's view of one screen's route. */
function useExpoRouterAdapter(): AdapterInterface {
	// Any screen of any navigator: its params are whatever its route declares.
	const navigation = useNavigation<NavigationProp<ParamListBase>>();
	const pathname = usePathname();
	const params = useLocalSearchParams();
	const searchParams = React.useMemo((): URLSearchParams => toUrlSearchParams(params), [params]);
	// What the route carries right now, including a write the router has not rendered yet.
	const snapshot = React.useRef(searchParams);
	React.useLayoutEffect((): void => {
		snapshot.current = searchParams;
	}, [searchParams]);
	const updateUrl = React.useCallback(
		(search: URLSearchParams): void => {
			navigation.replaceParams(routeParamsOf(search));
			snapshot.current = new URLSearchParams(search);
		},
		[navigation],
	);
	const getSearchParamsSnapshot = React.useCallback((): URLSearchParams => new URLSearchParams(snapshot.current), []);
	return { searchParams, pathname, updateUrl, getSearchParamsSnapshot };
}

const ExpoRouterNuqsAdapter = createAdapterProvider(useExpoRouterAdapter);

export interface UrlStateProviderProps {
	readonly children: React.ReactNode;
}

/** The app-wide URL-state engine (nuqs on Expo Router). */
export function UrlStateProvider({ children }: UrlStateProviderProps): React.JSX.Element {
	return <ExpoRouterNuqsAdapter>{children}</ExpoRouterNuqsAdapter>;
}
