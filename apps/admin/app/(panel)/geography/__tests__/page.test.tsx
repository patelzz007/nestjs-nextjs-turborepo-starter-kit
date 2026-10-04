// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { epochMs, type ApiPaginatedMeta, type DataValue, type Envelope, type GeoStats } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GEO_URL_STATE } from "@/lib/url-state/geography";

import type { GeoViewProps } from "../geo-table";
import GeoPage from "../page";

const { geoView, statsQuery, countriesQuery, statesQuery, citiesQuery } = vi.hoisted(() => ({
	geoView: vi.fn<(props: GeoViewProps) => null>(),
	statsQuery: vi.fn(),
	countriesQuery: vi.fn(),
	statesQuery: vi.fn(),
	citiesQuery: vi.fn(),
}));

// The admin server API helper (it forwards the admin session cookies) is the
// boundary: each endpoint records the input the page asked for.
vi.mock("@/lib/admin-server-api", () => ({
	createAdminServerCaller: (): object => ({
		geo: {
			stats: { query: statsQuery },
			countries: { query: countriesQuery },
			states: { query: statesQuery },
			cities: { query: citiesQuery },
		},
	}),
}));

// The client table is replaced by a probe: this suite checks what the server hands it.
vi.mock("../geo-table", () => ({ default: geoView }));

const STATS: GeoStats = { regions: 6, subregions: 22, countries: 250, states: 5_000, cities: 150_000 };
/** Fixed answer time of the fixture envelopes. */
const FIXTURE_TIMESTAMP = epochMs(1_786_300_000_000);

/** A one-page list envelope as the API returns it (real pagination meta, no placeholders). */
function pageEnvelope<TItem extends DataValue>(items: TItem[]): Envelope<TItem[]> {
	const meta: ApiPaginatedMeta = {
		correlationId: "fixture",
		timestamp: FIXTURE_TIMESTAMP,
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

const PAGE_ENVELOPE = pageEnvelope([]);
const STATS_ENVELOPE: Envelope<GeoStats> = { success: true, data: STATS, meta: { correlationId: "fixture", timestamp: FIXTURE_TIMESTAMP } };

/** Renders the server page for a URL query, as Next.js passes it (`searchParams` is a Promise). */
async function renderPage(query: string): Promise<void> {
	render(await GeoPage({ searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(query))) }));
}

/** The props the page handed the client table. */
function viewProps(): GeoViewProps | undefined {
	return geoView.mock.lastCall?.[0];
}

/** The key the client table derives from the same address bar (it reads `useSearchParams()`). */
function clientStateKey(query: string): string {
	return GEO_URL_STATE.serialize(GEO_URL_STATE.parse(new URLSearchParams(query)));
}

beforeEach((): void => {
	geoView.mockReturnValue(null);
	statsQuery.mockResolvedValue(STATS_ENVELOPE);
	for (const query of [countriesQuery, statesQuery, citiesQuery]) {
		query.mockResolvedValue(PAGE_ENVELOPE);
	}
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
});

describe("GeoPage (server prefetch)", () => {
	it("prefetches the countries page (the default tab) the URL asks for, and no other tab", async () => {
		const query = "page=3&limit=50&sort=-name&search=ma";
		await renderPage(query);

		expect(countriesQuery).toHaveBeenCalledTimes(1);
		expect(countriesQuery).toHaveBeenCalledWith({ page: 3, limit: 50, sort: "-name", search: "ma" });
		expect(statesQuery).not.toHaveBeenCalled();
		expect(citiesQuery).not.toHaveBeenCalled();
		expect(viewProps()).toEqual({ initialStats: STATS_ENVELOPE, initialPage: { stateKey: clientStateKey(query), data: { tab: "countries", envelope: PAGE_ENVELOPE } } });
	});

	it("prefetches the states page with the URL's search and country filter", async () => {
		const query = "tab=states&page=2&search=sel&filter[countryCode]=MY";
		await renderPage(query);

		expect(statesQuery).toHaveBeenCalledTimes(1);
		expect(statesQuery).toHaveBeenCalledWith({ page: 2, limit: 20, search: "sel", filter: { countryCode: { eq: "MY" } } });
		expect(countriesQuery).not.toHaveBeenCalled();
		expect(citiesQuery).not.toHaveBeenCalled();
		expect(viewProps()?.initialPage).toEqual({ stateKey: clientStateKey(query), data: { tab: "states", envelope: PAGE_ENVELOPE } });
	});

	it("prefetches the cities page with the URL's sort and country filter", async () => {
		const query = "tab=cities&sort=-stateCode&filter[countryCode]=MY";
		await renderPage(query);

		expect(citiesQuery).toHaveBeenCalledTimes(1);
		expect(citiesQuery).toHaveBeenCalledWith({ page: 1, limit: 20, sort: "-stateCode", filter: { countryCode: { eq: "MY" } } });
		expect(countriesQuery).not.toHaveBeenCalled();
		expect(statesQuery).not.toHaveBeenCalled();
		expect(viewProps()?.initialPage).toEqual({ stateKey: clientStateKey(query), data: { tab: "cities", envelope: PAGE_ENVELOPE } });
	});

	it("binds the prefetch to a state key that includes the tab, so it never seeds another tab", async () => {
		await renderPage("tab=states");

		expect(viewProps()?.initialPage?.stateKey).toBe("tab=states");
		expect(viewProps()?.initialPage?.stateKey).not.toBe(clientStateKey(""));
	});

	it("ignores invalid params the same way the client table does", async () => {
		await renderPage("tab=planets&page=-1&limit=7&sort=passwordHash");

		expect(countriesQuery).toHaveBeenCalledWith({ page: 1, limit: 20 });
		expect(viewProps()?.initialPage?.stateKey).toBe("");
	});

	it("leaves the rows to the client fetch when the page prefetch fails", async () => {
		statesQuery.mockRejectedValue(new Error("API unavailable"));
		await renderPage("tab=states");

		expect(viewProps()).toEqual({ initialStats: STATS_ENVELOPE, initialPage: undefined });
	});

	it("still prefetches the page when the stats request fails", async () => {
		statsQuery.mockRejectedValue(new Error("API unavailable"));
		await renderPage("");

		expect(statsQuery).toHaveBeenCalledWith({});
		expect(viewProps()).toEqual({ initialStats: undefined, initialPage: { stateKey: "", data: { tab: "countries", envelope: PAGE_ENVELOPE } } });
	});
});
