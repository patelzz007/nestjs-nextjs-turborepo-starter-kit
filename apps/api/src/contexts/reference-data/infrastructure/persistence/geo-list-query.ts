import type { Prisma } from "@prisma/client";
import type {
	CityListQuery,
	CityListSortField,
	CountryListQuery,
	CountryListSortField,
	RegionListQuery,
	RegionListSortField,
	StateListQuery,
	StateListSortField,
	SubregionListQuery,
	SubregionListSortField,
} from "@workspace/shared";
import { z } from "zod";

import { defineKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import type { SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaBooleanFilter,
	toPrismaComparableFilter,
	toPrismaNullableComparableFilter,
	toPrismaNullableStringFilter,
	toPrismaStringFilter,
} from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";

// ── Geo list queries → Prisma (explicit field → column mapping; docs/technical/api/list-queries.md) ──

/** Upper bound on fuzzy-search matches a geo list narrows to before filtering / paging. */
export const GEO_SEARCH_MAX_MATCHES = 200;

/** Every geo list's default order is `id asc`, so its keyset is just the numeric id. */
const GeoIdPositionSchema = z.object({ id: z.number().int().nonnegative() }).strict();

export function geoIdKeyset<TRow extends { readonly id: number }, TWhere>(after: (id: number) => TWhere): ListKeyset<TRow, TWhere> {
	return defineKeyset({
		position: GeoIdPositionSchema,
		read: (row: TRow) => ({ id: row.id }),
		after: (position) => after(position.id),
	});
}

// ── Sort columns (explicit API field → column mapping per entity) ──────────

export const REGION_SORT_COLUMNS: SortColumns<RegionListSortField, Prisma.RegionOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
};

export const SUBREGION_SORT_COLUMNS: SortColumns<SubregionListSortField, Prisma.SubregionOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
};

export const COUNTRY_SORT_COLUMNS: SortColumns<CountryListSortField, Prisma.CountryOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
	iso2: (direction) => ({ iso2: direction }),
};

export const STATE_SORT_COLUMNS: SortColumns<StateListSortField, Prisma.StateOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
	countryCode: (direction) => ({ countryCode: direction }),
	iso2: (direction) => ({ iso2: direction }),
};

export const CITY_SORT_COLUMNS: SortColumns<CityListSortField, Prisma.CityOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
	countryCode: (direction) => ({ countryCode: direction }),
	stateCode: (direction) => ({ stateCode: direction }),
};

// ── List where builders (filter AST → explicit columns) ────────────────────

export function buildRegionListWhere(query: RegionListQuery, searchIds: readonly number[] | undefined): Prisma.RegionWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaComparableFilter(filter?.id), (id) => ({ id })),
			...fieldWhere(toPrismaBooleanFilter(filter?.flag), (flag) => ({ flag })),
			...(searchIds !== undefined ? [{ id: { in: [...searchIds] } }] : []),
		],
	};
}

export function buildSubregionListWhere(query: SubregionListQuery, searchIds: readonly number[] | undefined): Prisma.SubregionWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaComparableFilter(filter?.id), (id) => ({ id })),
			...fieldWhere(toPrismaComparableFilter(filter?.regionId), (regionId) => ({ regionId })),
			...fieldWhere(toPrismaBooleanFilter(filter?.flag), (flag) => ({ flag })),
			...(searchIds !== undefined ? [{ id: { in: [...searchIds] } }] : []),
		],
	};
}

export function buildCountryListWhere(query: CountryListQuery, searchIds: readonly number[] | undefined): Prisma.CountryWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaComparableFilter(filter?.id), (id) => ({ id })),
			...fieldWhere(toPrismaNullableStringFilter(filter?.iso2), (iso2) => ({ iso2 })),
			...fieldWhere(toPrismaNullableComparableFilter(filter?.regionId), (regionId) => ({ regionId })),
			...fieldWhere(toPrismaNullableComparableFilter(filter?.subregionId), (subregionId) => ({ subregionId })),
			...fieldWhere(toPrismaBooleanFilter(filter?.flag), (flag) => ({ flag })),
			...(searchIds !== undefined ? [{ id: { in: [...searchIds] } }] : []),
		],
	};
}

export function buildStateListWhere(query: StateListQuery, searchIds: readonly number[] | undefined): Prisma.StateWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaComparableFilter(filter?.id), (id) => ({ id })),
			...fieldWhere(toPrismaComparableFilter(filter?.countryId), (countryId) => ({ countryId })),
			...fieldWhere(toPrismaStringFilter(filter?.countryCode), (countryCode) => ({ countryCode })),
			...fieldWhere(toPrismaBooleanFilter(filter?.flag), (flag) => ({ flag })),
			...(searchIds !== undefined ? [{ id: { in: [...searchIds] } }] : []),
		],
	};
}

export function buildCityListWhere(query: CityListQuery, searchIds: readonly number[] | undefined): Prisma.CityWhereInput {
	const filter = query.filter;
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaComparableFilter(filter?.id), (id) => ({ id })),
			...fieldWhere(toPrismaComparableFilter(filter?.stateId), (stateId) => ({ stateId })),
			...fieldWhere(toPrismaComparableFilter(filter?.countryId), (countryId) => ({ countryId })),
			...fieldWhere(toPrismaStringFilter(filter?.countryCode), (countryCode) => ({ countryCode })),
			...fieldWhere(toPrismaStringFilter(filter?.stateCode), (stateCode) => ({ stateCode })),
			...fieldWhere(toPrismaBooleanFilter(filter?.flag), (flag) => ({ flag })),
			...(searchIds !== undefined ? [{ id: { in: [...searchIds] } }] : []),
		],
	};
}

/**
 * `?include=a,b` → the Prisma include built from the matching fragments of
 * `fragments` (in their declared order); `undefined` when nothing matches.
 */
export function parseInclude<TInclude extends object>(include: string | undefined, fragments: Readonly<Record<string, TInclude>>): TInclude | undefined {
	if (!include) return undefined;
	const parts = include.split(",").map((s) => s.trim());
	const picked: TInclude[] = Object.entries(fragments)
		.filter(([token]) => parts.includes(token))
		.map(([, fragment]) => fragment);
	return picked.length > 0 ? picked.reduce((merged, fragment) => ({ ...merged, ...fragment })) : undefined;
}

export const LIVE_ONLY = { where: { isDeleted: false } } satisfies { where: { isDeleted: boolean } };

export const REGION_INCLUDES: Readonly<Record<string, Prisma.RegionInclude>> = { subregions: { subregions: LIVE_ONLY }, countries: { countries: LIVE_ONLY } };
export const SUBREGION_INCLUDES: Readonly<Record<string, Prisma.SubregionInclude>> = { region: { region: true }, countries: { countries: LIVE_ONLY } };
export const COUNTRY_INCLUDES: Readonly<Record<string, Prisma.CountryInclude>> = {
	region: { regionRelation: true },
	subregion: { subregionRelation: true },
	states: { states: LIVE_ONLY },
	cities: { cities: LIVE_ONLY },
};
export const STATE_INCLUDES: Readonly<Record<string, Prisma.StateInclude>> = { country: { country: true }, cities: { cities: LIVE_ONLY } };
export const CITY_INCLUDES: Readonly<Record<string, Prisma.CityInclude>> = { state: { state: true }, country: { country: true } };
