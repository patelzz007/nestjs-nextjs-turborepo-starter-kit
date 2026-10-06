// @vitest-environment jsdom
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { QueryProvider } from "@workspace/client/lib/api/query-provider";
import type { PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import {
	epochMs,
	nowEpochMs,
	type ApiPaginatedMeta,
	type EpochMs,
	type CityListItem,
	type CountryListItem,
	type DataValue,
	type Envelope,
	type GeoStats,
	type SerializableInput,
	type StateListItem,
} from "@workspace/shared";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GEO_URL_STATE, type GeoTab, type GeoTabPage } from "@/lib/url-state/geography";

import GeoView from "../geo-table";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

type GeoListEnvelope = Envelope<DataValue[]>;

/** Longer than the query cache's stale time (one minute), so an answer this old must be refetched. */
const STALE_ANSWER_AGE_MS = 2 * 60 * 1000;

/** A one-page list envelope as the API returns it (real pagination meta, no placeholders), answered at `timestamp` (default: just now). */
function pageEnvelope<TItem extends DataValue>(items: TItem[], timestamp: EpochMs = nowEpochMs()): Envelope<TItem[]> {
	const meta: ApiPaginatedMeta = {
		correlationId: "fixture",
		timestamp,
		limit: 20,
		total: items.length,
		page: 1,
		totalPages: 1,
		nextCursor: null,
		hasNext: false,
		hasPrevious: false,
	};
	return { success: true, data: items, meta };
}

/** The `useQuery` options the view passes that the cached stub below forwards. */
interface GeoListQueryOptions {
	readonly enabled: boolean;
	readonly initialData?: GeoListEnvelope;
}

type GeoListHook = (input: SerializableInput, options: GeoListQueryOptions) => UseQueryResult<GeoListEnvelope>;

const { statsQuery, countriesQuery, statesQuery, citiesQuery, transport } = vi.hoisted(() => ({
	statsQuery: vi.fn(),
	countriesQuery: vi.fn(),
	statesQuery: vi.fn(),
	citiesQuery: vi.fn(),
	transport: vi.fn<(tab: GeoTab, input: SerializableInput) => Promise<GeoListEnvelope>>(),
}));

// The view reads its state from the address bar, as Next.js's
// `useSearchParams` does once the History API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			geo: {
				stats: { useQuery: statsQuery },
				countries: { useQuery: countriesQuery },
				states: { useQuery: statesQuery },
				cities: { useQuery: citiesQuery },
			},
		},
	}),
}));

const PATH = "/geography";
const EMPTY_RESULT = { data: { data: [] }, isLoading: false, isError: false, isFetching: false };

const MALAYSIA: CountryListItem = {
	id: 132,
	name: "Malaysia",
	iso3: "MYS",
	numericCode: "458",
	iso2: "MY",
	phonecode: "60",
	capital: "Kuala Lumpur",
	currency: "MYR",
	currencyName: "Malaysian ringgit",
	currencySymbol: "RM",
	tld: ".my",
	native: "Malaysia",
	population: null,
	gdp: null,
	region: "Asia",
	subregion: "South-Eastern Asia",
	nationality: "Malaysian",
	timezones: null,
	translations: null,
	latitude: 2.5,
	longitude: 112.5,
	emoji: null,
	emojiU: null,
	wikiDataId: null,
	flag: true,
	regionId: null,
	subregionId: null,
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
};
const SELANGOR: StateListItem = {
	id: 1949,
	name: "Selangor",
	countryCode: "MY",
	fipsCode: null,
	iso2: "10",
	iso3166_2: "MY-10",
	type: "state",
	level: null,
	parentId: null,
	native: null,
	latitude: null,
	longitude: null,
	timezone: null,
	translations: null,
	wikiDataId: null,
	flag: true,
	countryId: MALAYSIA.id,
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
};
const KUALA_LUMPUR: CityListItem = {
	id: 76_497,
	name: "Kuala Lumpur",
	stateCode: "14",
	countryCode: "MY",
	latitude: 3.1478,
	longitude: 101.6953,
	native: null,
	timezone: null,
	translations: null,
	wikiDataId: null,
	flag: true,
	stateId: 1950,
	countryId: MALAYSIA.id,
	createdAt: 1_786_300_000_000,
	updatedAt: 1_786_300_000_000,
};
const COUNTRIES_ENVELOPE: Envelope<CountryListItem[]> = pageEnvelope([MALAYSIA]);
const STATES_ENVELOPE: Envelope<StateListItem[]> = pageEnvelope([]);

/** The state key the server page computes from its `searchParams` for this URL query. */
function serverStateKey(query: string): string {
	return GEO_URL_STATE.serialize(GEO_URL_STATE.parse(new URLSearchParams(query)));
}

/** What the server page hands the view after prefetching the default (countries) tab of `/geography`. */
const COUNTRIES_PREFETCH: PrefetchedQuery<GeoTabPage> = { stateKey: serverStateKey(""), data: { tab: "countries", envelope: COUNTRIES_ENVELOPE } };

/**
 * A tab's `useQuery` backed by the REAL TanStack Query cache (under the app's
 * own `QueryProvider` defaults); only the transport is stubbed. Caching,
 * staleness and `initialData` therefore behave exactly as in the app.
 */
function cachedGeoListHook(tab: GeoTab): GeoListHook {
	return function useCachedGeoList(input: SerializableInput, options: GeoListQueryOptions): UseQueryResult<GeoListEnvelope> {
		return useQuery({
			queryKey: ["geo", tab, input],
			queryFn: (): Promise<GeoListEnvelope> => transport(tab, input),
			enabled: options.enabled,
			...initialDataOption(options.initialData),
		});
	};
}

function withRealQueryCache(): void {
	countriesQuery.mockImplementation(cachedGeoListHook("countries"));
	statesQuery.mockImplementation(cachedGeoListHook("states"));
	citiesQuery.mockImplementation(cachedGeoListHook("cities"));
}

/** The view under the providers the app's root layout mounts (query cache + kit labels), so server rendering sees them too. */
function cachedView(initialPage: PrefetchedQuery<GeoTabPage>): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<QueryProvider>
				<GeoView initialPage={initialPage} />
			</QueryProvider>
		</UiKitTestProviders>
	);
}

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	statsQuery.mockReturnValue({ data: undefined });
	for (const query of [countriesQuery, statesQuery, citiesQuery]) {
		query.mockReturnValue(EMPTY_RESULT);
	}
	transport.mockResolvedValue(pageEnvelope([]));
});

afterEach((): void => {
	cleanup();
	for (const query of [statsQuery, countriesQuery, statesQuery, citiesQuery, transport]) {
		query.mockReset();
	}
	vi.restoreAllMocks();
});

describe("GeoView stats", () => {
	it("seeds the stats query with the server's envelope and its answer time, so the client does not fetch them again", () => {
		const statsEnvelope: Envelope<GeoStats> = {
			success: true,
			data: { regions: 6, subregions: 22, countries: 250, states: 5_000, cities: 150_000 },
			meta: { correlationId: "fixture", timestamp: nowEpochMs() },
		};
		statsQuery.mockReturnValue({ data: statsEnvelope });

		render(<GeoView initialStats={statsEnvelope} />, { wrapper: UiKitTestProviders });

		expect(statsQuery).toHaveBeenCalledWith({}, { initialData: statsEnvelope, initialDataUpdatedAt: statsEnvelope.meta.timestamp });
		expect(screen.getByText("Subregions")).toBeDefined();
	});
});

describe("GeoView URL state", () => {
	it("fetches only the active tab, with the URL's sort, search and country filter", () => {
		window.history.replaceState(null, "", `${PATH}?tab=states&sort=-stateCode&search=sel&filter[countryCode]=MY`);
		render(<GeoView />, { wrapper: UiKitTestProviders });

		expect(statesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: "sel", filter: { countryCode: { eq: "MY" } } }, expect.objectContaining({ enabled: true }));
		expect(countriesQuery).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ enabled: false }));
		expect(citiesQuery).toHaveBeenLastCalledWith(
			{ page: 1, limit: 20, sort: "-stateCode", search: "sel", filter: { countryCode: { eq: "MY" } } },
			expect.objectContaining({ enabled: false }),
		);
		expect(screen.getByRole("textbox", { name: "Country code" }).getAttribute("value")).toBe("MY");
	});

	it("pushes a tab change and clears the previous tab's list params", () => {
		window.history.replaceState(null, "", `${PATH}?page=3&sort=name&search=ma`);
		const pushState = vi.spyOn(window.history, "pushState");
		render(<GeoView />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: /Cities/ }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?tab=cities");
	});

	it("follows the URL's tab on back/forward", () => {
		window.history.replaceState(null, "", `${PATH}?tab=cities`);
		const view = render(<GeoView />, { wrapper: UiKitTestProviders });
		window.history.replaceState(null, "", PATH);
		view.rerender(<GeoView />);

		expect(countriesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.objectContaining({ enabled: true }));
	});
});

describe("GeoView server-prefetched page", () => {
	it("seeds only the active tab's query, and only while the URL is in the state the server fetched", () => {
		window.history.replaceState(null, "", `${PATH}?tab=states&page=2`);
		const initialPage: PrefetchedQuery<GeoTabPage> = { stateKey: serverStateKey("tab=states&page=2"), data: { tab: "states", envelope: STATES_ENVELOPE } };
		const view = render(<GeoView initialPage={initialPage} />, { wrapper: UiKitTestProviders });

		expect(statesQuery).toHaveBeenLastCalledWith({ page: 2, limit: 20 }, expect.objectContaining({ enabled: true, initialData: STATES_ENVELOPE }));
		expect(countriesQuery).toHaveBeenLastCalledWith(expect.anything(), expect.not.objectContaining({ initialData: STATES_ENVELOPE }));
		expect(citiesQuery).toHaveBeenLastCalledWith(expect.anything(), expect.not.objectContaining({ initialData: STATES_ENVELOPE }));

		window.history.replaceState(null, "", `${PATH}?tab=states&page=3`);
		view.rerender(<GeoView initialPage={initialPage} />);

		expect(statesQuery).toHaveBeenLastCalledWith({ page: 3, limit: 20 }, expect.not.objectContaining({ initialData: STATES_ENVELOPE }));
	});

	it("fetches a newly selected tab on the client, never seeding it with another tab's page", () => {
		const view = render(<GeoView initialPage={COUNTRIES_PREFETCH} />, { wrapper: UiKitTestProviders });
		expect(countriesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.objectContaining({ enabled: true, initialData: COUNTRIES_ENVELOPE }));

		fireEvent.click(screen.getByRole("button", { name: /Cities/ }));
		// Next.js re-renders `useSearchParams()` consumers after a History API write.
		view.rerender(<GeoView initialPage={COUNTRIES_PREFETCH} />);

		expect(citiesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.objectContaining({ enabled: true }));
		expect(citiesQuery).toHaveBeenLastCalledWith(expect.anything(), expect.not.objectContaining({ initialData: COUNTRIES_ENVELOPE }));
		expect(countriesQuery).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ enabled: false }));
	});

	it("renders the prefetched rows in the server HTML without fetching them", () => {
		withRealQueryCache();

		const html = renderToString(cachedView(COUNTRIES_PREFETCH));

		expect(html).toContain(MALAYSIA.name);
		expect(transport).not.toHaveBeenCalled();
	});

	it("does not refetch the server's page when the user switches to another tab and back", async () => {
		withRealQueryCache();
		const view = render(cachedView(COUNTRIES_PREFETCH));
		expect(screen.getByText(MALAYSIA.name)).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: /States/ }));
		view.rerender(cachedView(COUNTRIES_PREFETCH));
		await waitFor((): void => {
			expect(transport).toHaveBeenCalledWith("states", { page: 1, limit: 20 });
		});

		fireEvent.click(screen.getByRole("button", { name: /Countries/ }));
		view.rerender(cachedView(COUNTRIES_PREFETCH));

		expect(window.location.search).toBe("");
		expect(transport).toHaveBeenCalledTimes(1);
		expect(transport).not.toHaveBeenCalledWith("countries", expect.anything());
	});

	it("refetches a server page whose answer is older than the stale time (the server's timestamp, not the hydration time, counts)", async () => {
		withRealQueryCache();
		const stalePrefetch: PrefetchedQuery<GeoTabPage> = {
			stateKey: serverStateKey(""),
			data: { tab: "countries", envelope: pageEnvelope([MALAYSIA], epochMs(Date.now() - STALE_ANSWER_AGE_MS)) },
		};

		render(cachedView(stalePrefetch));

		expect(screen.getByText(MALAYSIA.name)).toBeDefined();
		await waitFor((): void => {
			expect(transport).toHaveBeenCalledWith("countries", { page: 1, limit: 20 });
		});
	});

	it("restores the server's page from the cache on Back, without refetching it", async () => {
		withRealQueryCache();
		const view = render(cachedView(COUNTRIES_PREFETCH));

		fireEvent.click(screen.getByRole("button", { name: /Cities/ }));
		view.rerender(cachedView(COUNTRIES_PREFETCH));
		await waitFor((): void => {
			expect(transport).toHaveBeenCalledWith("cities", { page: 1, limit: 20 });
		});

		// Back: the address bar returns to the server-rendered URL.
		window.history.replaceState(null, "", PATH);
		view.rerender(cachedView(COUNTRIES_PREFETCH));

		expect(countriesQuery).toHaveBeenLastCalledWith({ page: 1, limit: 20 }, expect.objectContaining({ enabled: true }));
		expect(transport).not.toHaveBeenCalledWith("countries", expect.anything());
	});
});

describe("GeoView rows", () => {
	function listResult(envelope: GeoListEnvelope): { readonly data: GeoListEnvelope; readonly isLoading: boolean; readonly isError: boolean; readonly isFetching: boolean } {
		return { data: envelope, isLoading: false, isError: false, isFetching: false };
	}

	it("shows a country's iso2 and active flag", () => {
		countriesQuery.mockReturnValue(listResult(COUNTRIES_ENVELOPE));
		render(<GeoView />, { wrapper: UiKitTestProviders });

		const row = screen.getByRole("row", { name: /Malaysia/ });
		expect(within(row).getByText("MY")).toBeDefined();
		expect(within(row).getByText("Active")).toBeDefined();
	});

	it("shows a state's own iso2 as its state code and a missing coordinate as a dash", () => {
		window.history.replaceState(null, "", `${PATH}?tab=states`);
		statesQuery.mockReturnValue(listResult(pageEnvelope([SELANGOR])));
		render(<GeoView />, { wrapper: UiKitTestProviders });

		const row = screen.getByRole("row", { name: /Selangor/ });
		expect(within(row).getByText("10")).toBeDefined();
		expect(within(row).getAllByText("—")).toHaveLength(2);
	});

	it("shows a city's state code and its coordinates to four decimals", () => {
		window.history.replaceState(null, "", `${PATH}?tab=cities`);
		citiesQuery.mockReturnValue(listResult(pageEnvelope([KUALA_LUMPUR])));
		render(<GeoView />, { wrapper: UiKitTestProviders });

		const row = screen.getByRole("row", { name: /Kuala Lumpur/ });
		expect(within(row).getByText("14")).toBeDefined();
		expect(within(row).getByText("3.1478")).toBeDefined();
		expect(within(row).getByText("101.6953")).toBeDefined();
	});
});
