import { eqFilter, listStateToListQuery, toListSearch, type ListSortSpec, type SortColumnAliases, type TableListQueryInput } from "@workspace/client/lib/api/list-query";
import { listFilterKey, listSearchParam, listTextFilterParam, listUrlParams } from "@workspace/client/lib/url-state/list-url-state";
import { defineUrlState, urlParamWithDefault } from "@workspace/client/lib/url-state/url-state";
import {
	cityListQuery,
	countryListQuery,
	stateListQuery,
	type CityListItem,
	type CityListSortField,
	type CountryListItem,
	type CountryListSortField,
	type Envelope,
	type StateListItem,
	type StateListSortField,
} from "@workspace/shared";
import { z } from "zod";

import { GEOGRAPHY_TAB_PARAM } from "@/lib/routes";

/** The geography browser's tabs, one list endpoint each. */
export const GeoTabSchema = z.enum(["countries", "states", "cities"]);
export type GeoTab = z.output<typeof GeoTabSchema>;
/** The tab shown when the URL names none. */
export const DEFAULT_GEO_TAB: GeoTab = "countries";

/** Page sizes the geography tables offer. */
export const GEO_PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];
/** Default page size — omitted from the URL. */
export const GEO_DEFAULT_PAGE_SIZE = 20;

export type GeoSortField = CountryListSortField | StateListSortField | CityListSortField;

/**
 * The URL's `sort` accepts any field one of the three tabs can sort by; each
 * tab's input then keeps only its own whitelist (`listStateToListQuery`). All
 * three resources default to `id` ascending.
 */
const GEO_SORT_SPEC: ListSortSpec<GeoSortField> = {
	sortable: [...new Set<GeoSortField>([...countryListQuery.sortable, ...stateListQuery.sortable, ...cityListQuery.sortable])],
	defaultSort: countryListQuery.defaultSort,
};

/** Country rows show the country's `iso2` in the `countryCode` column. */
export const COUNTRY_SORT_ALIASES: SortColumnAliases<CountryListSortField> = { countryCode: "iso2" };
/** State rows show the state's own `iso2` in the `stateCode` column. */
export const STATE_SORT_ALIASES: SortColumnAliases<StateListSortField> = { stateCode: "iso2" };
/** City columns are named after their API fields. */
export const CITY_SORT_ALIASES: SortColumnAliases<CityListSortField> = {};

/**
 * `/geography` state: `?tab=` plus the active tab's list keys (`page`, `limit`,
 * `cursor`, `sort`, `search`, `filter[countryCode]` for states and cities).
 */
export const GEO_URL_STATE = defineUrlState(
	{
		tab: urlParamWithDefault(GeoTabSchema, DEFAULT_GEO_TAB),
		...listUrlParams(GEO_SORT_SPEC, { pageSizes: GEO_PAGE_SIZE_OPTIONS, defaultLimit: GEO_DEFAULT_PAGE_SIZE }),
		search: listSearchParam(),
		countryCode: listTextFilterParam(),
	},
	{ urlKeys: { tab: GEOGRAPHY_TAB_PARAM, countryCode: listFilterKey("countryCode") } },
);

export type GeoUrlState = typeof GEO_URL_STATE.defaults;

export type GeoCountryCodeFilter = Readonly<{ countryCode: { eq: string } | undefined }>;
export type GeoNoFilter = Readonly<Record<string, undefined>>;

function countryCodeFilter(state: GeoUrlState): GeoCountryCodeFilter {
	return { countryCode: eqFilter(toListSearch(state.countryCode ?? "")) };
}

/** `GET /geo/countries` input for the URL state. */
export function toCountriesListQuery(state: GeoUrlState): TableListQueryInput<GeoNoFilter> {
	return listStateToListQuery(countryListQuery, { pagination: state, sort: state.sort, search: state.search });
}

/** `GET /geo/states` input for the URL state. */
export function toStatesListQuery(state: GeoUrlState): TableListQueryInput<GeoCountryCodeFilter> {
	return listStateToListQuery(stateListQuery, { pagination: state, sort: state.sort, search: state.search, filter: countryCodeFilter(state) });
}

/** `GET /geo/cities` input for the URL state. */
export function toCitiesListQuery(state: GeoUrlState): TableListQueryInput<GeoCountryCodeFilter> {
	return listStateToListQuery(cityListQuery, { pagination: state, sort: state.sort, search: state.search, filter: countryCodeFilter(state) });
}

/**
 * One tab's list response, tagged with that tab. The server page prefetches
 * only the URL's active tab, and each tab's rows have their own type, so the
 * tag tells the table which tab's query may take the envelope as `initialData`.
 */
export type GeoTabPage =
	| { readonly tab: "countries"; readonly envelope: Envelope<CountryListItem[]> }
	| { readonly tab: "states"; readonly envelope: Envelope<StateListItem[]> }
	| { readonly tab: "cities"; readonly envelope: Envelope<CityListItem[]> };
