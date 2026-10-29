// ============================================
// lib/url-state/url-state-test-provider.tsx - the URL-state engine for component tests
// ============================================
// A component test renders a screen without a router. This runs the same engine (`useUrlState` on
// nuqs) against an in-memory query string instead: it starts from `searchParams`, keeps every write
// (so the screen re-reads what it wrote), and reports each write to `onUrlUpdate` so a test can
// assert the URL. Writes land on the next tick, as on a phone: assert them with `waitFor`.
//
// It is a nuqs custom adapter like the app's (url-state-provider.tsx), not nuqs's own testing
// adapter: that one reads the browser's `location` for the pathname, which React Native lacks. The
// Expo Router adapter itself is tested against a real in-memory router (url-state-provider.test.tsx).

import {
	renderQueryString,
	unstable_createAdapterProvider as createAdapterProvider,
	type unstable_AdapterInterface as AdapterInterface,
	type unstable_AdapterOptions as AdapterOptions,
} from "nuqs/adapters/custom";
import * as React from "react";

/** The path the in-memory URL lives at. */
const TEST_PATHNAME = "/";

/** Writes go out at once, not throttled: a test asserts them without waiting out a rate limit. */
const NO_RATE_LIMIT = 0;

/** One write to the in-memory URL. */
export interface UrlUpdateEvent {
	readonly searchParams: URLSearchParams;
	/** The whole query, with its `?` (`"?page=3"`), or `""` when it is empty. */
	readonly queryString: string;
	readonly options: Required<AdapterOptions>;
}

type MemoryUrl = Pick<AdapterInterface, "searchParams" | "updateUrl" | "getSearchParamsSnapshot">;

const MemoryUrlContext = React.createContext<MemoryUrl | null>(null);

function useMemoryUrlAdapter(): AdapterInterface {
	const memory = React.use(MemoryUrlContext);
	if (memory === null) {
		throw new Error("useUrlState under test needs a UrlStateTestProvider around it.");
	}
	return { ...memory, pathname: TEST_PATHNAME, rateLimitFactor: NO_RATE_LIMIT };
}

const MemoryNuqsAdapter = createAdapterProvider(useMemoryUrlAdapter);

export interface UrlStateTestProviderProps {
	/** The query string the screen opens with (`"?page=2"`); none by default. */
	readonly searchParams?: string;
	/** Called with every write. */
	readonly onUrlUpdate?: (event: UrlUpdateEvent) => void;
	readonly children: React.ReactNode;
}

/** `useUrlState` for tests, backed by an in-memory URL. */
export function UrlStateTestProvider({ searchParams = "", onUrlUpdate, children }: UrlStateTestProviderProps): React.JSX.Element {
	const [search, setSearch] = React.useState((): URLSearchParams => new URLSearchParams(searchParams));
	const snapshot = React.useRef(search);
	const memory = React.useMemo(
		(): MemoryUrl => ({
			searchParams: search,
			updateUrl: (next: URLSearchParams, options: Required<AdapterOptions>): void => {
				snapshot.current = new URLSearchParams(next);
				setSearch(new URLSearchParams(next));
				onUrlUpdate?.({ searchParams: new URLSearchParams(next), queryString: renderQueryString(next), options });
			},
			getSearchParamsSnapshot: (): URLSearchParams => new URLSearchParams(snapshot.current),
		}),
		[onUrlUpdate, search],
	);
	return (
		<MemoryUrlContext value={memory}>
			<MemoryNuqsAdapter>{children}</MemoryNuqsAdapter>
		</MemoryUrlContext>
	);
}
