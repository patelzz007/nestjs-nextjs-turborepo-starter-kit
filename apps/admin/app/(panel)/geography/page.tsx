import { createAdminServerCaller, type AdminServerCaller } from "@/lib/admin-server-api";
import { toPrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { GEO_URL_STATE, toCitiesListQuery, toCountriesListQuery, toStatesListQuery, type GeoTabPage, type GeoUrlState } from "@/lib/url-state/geography";

import GeoView from "./geo-table";

export const dynamic = "force-dynamic";

/** The page the URL asks for on its active tab. Only that tab's endpoint is called. */
async function fetchActiveTabPage(server: AdminServerCaller, urlState: GeoUrlState): Promise<GeoTabPage> {
	switch (urlState.tab) {
		case "countries":
			return { tab: "countries", envelope: await server.geo.countries.query(toCountriesListQuery(urlState)) };
		case "states":
			return { tab: "states", envelope: await server.geo.states.query(toStatesListQuery(urlState)) };
		case "cities":
			return { tab: "cities", envelope: await server.geo.cities.query(toCitiesListQuery(urlState)) };
	}
}

/**
 * `/geography` — geographic reference data. The table's state (`?tab=`, page,
 * page size, cursor, sort, search, `filter[countryCode]`) lives in the URL
 * (lib/url-state/geography). The server parses it and prefetches the stats and
 * exactly the page the URL asks for on its active tab, so a shared or reloaded
 * link renders that page in the initial HTML. A failed prefetch leaves that
 * part to the client fetch.
 */
export default async function GeoPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<React.JSX.Element> {
	const urlState = GEO_URL_STATE.parse(await searchParams);
	const server = createAdminServerCaller();
	const [statsResult, pageResult] = await Promise.allSettled([server.geo.stats.query({}), fetchActiveTabPage(server, urlState)]);

	return (
		<GeoView
			initialStats={statsResult.status === "fulfilled" ? statsResult.value.data : undefined}
			initialPage={toPrefetchedQuery(GEO_URL_STATE.serialize(urlState), pageResult)}
		/>
	);
}
