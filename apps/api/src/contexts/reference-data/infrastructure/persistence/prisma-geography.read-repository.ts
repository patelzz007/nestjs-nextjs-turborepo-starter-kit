import type { Prisma } from "@prisma/client";
import {
	cityListQuery,
	countryListQuery,
	regionListQuery,
	stateListQuery,
	subregionListQuery,
	type CascadePreviewResult,
	type City,
	type CityListItem,
	type CityListQuery,
	type Country,
	type CountryListItem,
	type CountryListQuery,
	type GeoAutocompleteItem,
	type GeoAutocompleteQuery,
	type GeoExportQuery,
	type GeoStats,
	type PaginatedServiceResult,
	type Region,
	type RegionListItem,
	type RegionListQuery,
	type State,
	type StateListItem,
	type StateListQuery,
	type Subregion,
	type SubregionListItem,
	type SubregionListQuery,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { buildListOrder } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { GeographyReadPort } from "../../application/ports/geography-read.port";
import type { GeoChildLevel } from "../../domain/policies/geo-cascade.policy";
import type { GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";
import { GEO_CASCADE_WHERE } from "./geo-cascade.where";
import {
	buildCityListWhere,
	buildCountryListWhere,
	buildRegionListWhere,
	buildStateListWhere,
	buildSubregionListWhere,
	CITY_INCLUDES,
	CITY_SORT_COLUMNS,
	COUNTRY_INCLUDES,
	COUNTRY_SORT_COLUMNS,
	GEO_SEARCH_MAX_MATCHES,
	geoIdKeyset,
	parseInclude,
	REGION_INCLUDES,
	REGION_SORT_COLUMNS,
	STATE_INCLUDES,
	STATE_SORT_COLUMNS,
	SUBREGION_INCLUDES,
	SUBREGION_SORT_COLUMNS,
} from "./geo-list-query";
import {
	toCityDto,
	toCityListItem,
	toCountryDto,
	toCountryListItem,
	toNullableGeoNumber,
	toRegionDto,
	toRegionListItem,
	toStateDto,
	toStateListItem,
	toSubregionDto,
	toSubregionListItem,
	type CityListRow,
	type CountryListRow,
	type RegionListRow,
	type StateListRow,
	type SubregionListRow,
} from "./geo.mappers";

/** Transaction client of one read (the actor's RLS session). */
type GeoReadClient = Prisma.TransactionClient;

/** The five geo tables a fuzzy search may run against (a closed union, never caller input). */
type GeoTable = "Region" | "Subregion" | "Country" | "State" | "City";

const LIVE = { isDeleted: false } satisfies { isDeleted: boolean };

/**
 * Find live IDs matching a search term using pg_trgm trigram similarity,
 * most similar first; falls back to ILIKE substring matching when the
 * trigram index finds nothing.
 */
async function fuzzySearchIds(db: GeoReadClient, table: GeoTable, search: string, limit: number): Promise<number[]> {
	const trigramSql = `SELECT id, similarity(name, $1) AS similarity FROM "${table}" WHERE "isDeleted" = false AND name % $1 ORDER BY similarity DESC LIMIT $2`;
	const trigramResults: { readonly id: number; readonly similarity: number }[] = await db.$queryRawUnsafe(trigramSql, search, limit);
	if (trigramResults.length > 0) {
		return trigramResults.map((r) => r.id);
	}
	const likeSql = `SELECT id FROM "${table}" WHERE "isDeleted" = false AND name ILIKE $1 LIMIT $2`;
	const likeResults: { readonly id: number }[] = await db.$queryRawUnsafe(likeSql, `%${search}%`, limit);
	return likeResults.map((r) => r.id);
}

async function searchIdsFor(db: GeoReadClient, table: GeoTable, search: string | undefined): Promise<readonly number[] | undefined> {
	return search === undefined ? undefined : fuzzySearchIds(db, table, search, GEO_SEARCH_MAX_MATCHES);
}

async function findCascadeRoot(db: GeoReadClient, entity: GeoParentKind, id: number): Promise<{ readonly name: string } | null> {
	const where = { id, ...LIVE };
	switch (entity) {
		case "region":
			return db.region.findFirst({ where });
		case "subregion":
			return db.subregion.findFirst({ where });
		case "country":
			return db.country.findFirst({ where });
		case "state":
			return db.state.findFirst({ where });
		default:
			return assertNever(entity);
	}
}

async function countLevel(db: GeoReadClient, entity: GeoParentKind, id: number, level: GeoChildLevel): Promise<number | undefined> {
	const where = GEO_CASCADE_WHERE[entity];
	switch (level) {
		case "subregions":
			return where.subregions === undefined ? undefined : db.subregion.count({ where: { ...LIVE, ...where.subregions(id) } });
		case "countries":
			return where.countries === undefined ? undefined : db.country.count({ where: { ...LIVE, ...where.countries(id) } });
		case "states":
			return where.states === undefined ? undefined : db.state.count({ where: { ...LIVE, ...where.states(id) } });
		case "cities":
			return where.cities === undefined ? undefined : db.city.count({ where: { ...LIVE, ...where.cities(id) } });
		default:
			return assertNever(level);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled geo value: ${JSON.stringify(value)}`);
}

/**
 * Geography reads. Each one runs under the actor's own RLS session
 * (`PrismaReadExecutor`, the geo tables are world-readable to signed-in
 * sessions) and always excludes soft-deleted rows.
 */
export class PrismaGeographyReadRepository implements GeographyReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<GeoReadClient>) {}

	public stats(actor: ActorContext): Promise<GeoStats> {
		return this.reads.read(actor, async (db): Promise<GeoStats> => {
			const live = { where: LIVE };
			const [regions, subregions, countries, states, cities]: [number, number, number, number, number] = await Promise.all([
				db.region.count(live),
				db.subregion.count(live),
				db.country.count(live),
				db.state.count(live),
				db.city.count(live),
			]);
			return { regions, subregions, countries, states, cities };
		});
	}

	public autocomplete(actor: ActorContext, query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		return this.reads.read(actor, async (db): Promise<readonly GeoAutocompleteItem[]> => {
			const { q, country, limit } = query;
			const nameMatch = { contains: q, mode: "insensitive" } satisfies Prisma.StringFilter;
			const countryFilter = country ? { countryCode: country } : {};
			const [regions, subregions, countries, states, cities] = await Promise.all([
				db.region.findMany({ where: { ...LIVE, name: nameMatch }, take: limit }),
				db.subregion.findMany({ where: { ...LIVE, name: nameMatch }, take: limit }),
				db.country.findMany({ where: { ...LIVE, name: nameMatch }, take: limit }),
				db.state.findMany({ where: { ...LIVE, name: nameMatch, ...countryFilter }, take: limit }),
				db.city.findMany({ where: { ...LIVE, name: nameMatch, ...countryFilter }, take: limit }),
			]);
			const none = { countryCode: null, stateCode: null, latitude: null, longitude: null, emoji: null };
			const items: GeoAutocompleteItem[] = [
				...regions.map((r): GeoAutocompleteItem => ({ id: r.id, name: r.name, entityType: "region", ...none })),
				...subregions.map((s): GeoAutocompleteItem => ({ id: s.id, name: s.name, entityType: "subregion", ...none })),
				...countries.map((c): GeoAutocompleteItem => ({
					id: c.id,
					name: c.name,
					entityType: "country",
					countryCode: c.iso2,
					stateCode: null,
					latitude: toNullableGeoNumber(c.latitude),
					longitude: toNullableGeoNumber(c.longitude),
					emoji: c.emoji,
				})),
				...states.map((s): GeoAutocompleteItem => ({
					id: s.id,
					name: s.name,
					entityType: "state",
					countryCode: s.countryCode,
					stateCode: s.iso2,
					latitude: toNullableGeoNumber(s.latitude),
					longitude: toNullableGeoNumber(s.longitude),
					emoji: null,
				})),
				...cities.map((c): GeoAutocompleteItem => ({
					id: c.id,
					name: c.name,
					entityType: "city",
					countryCode: c.countryCode,
					stateCode: c.stateCode,
					latitude: c.latitude.toNumber(),
					longitude: c.longitude.toNumber(),
					emoji: null,
				})),
			];
			return items.slice(0, limit);
		});
	}

	/** The cities of every country matching `countryCode` / `regionId` (the flat city rows ARE the export, `GeoExportResponseSchema`). */
	public exportCities(actor: ActorContext, query: GeoExportQuery): Promise<readonly City[]> {
		return this.reads.read(actor, async (db): Promise<readonly City[]> => {
			const { countryCode, regionId } = query;
			const countryWhere: Prisma.CountryWhereInput = {
				...LIVE,
				...(countryCode !== undefined ? { iso2: countryCode } : {}),
				...(regionId !== undefined ? { regionId } : {}),
			};
			const countries = await db.country.findMany({ where: countryWhere, orderBy: { name: "asc" } });
			if (countries.length === 0) return [];
			const states = await db.state.findMany({ where: { ...LIVE, countryId: { in: countries.map((c) => c.id) } }, orderBy: { name: "asc" } });
			const cities = await db.city.findMany({ where: { ...LIVE, stateId: { in: states.map((s) => s.id) } }, orderBy: { name: "asc" } });
			return cities.map(toCityDto);
		});
	}

	public cascadePreview(actor: ActorContext, entity: GeoParentKind, id: number, levels: readonly GeoChildLevel[]): Promise<CascadePreviewResult | null> {
		return this.reads.read(actor, async (db): Promise<CascadePreviewResult | null> => {
			const root = await findCascadeRoot(db, entity, id);
			if (root === null) {
				return null;
			}
			const willDelete: CascadePreviewResult["willDelete"] = {};
			// Sequential: an interactive transaction runs its statements on one connection anyway.
			for (const level of levels) {
				const count: number | undefined = await countLevel(db, entity, id, level);
				if (count !== undefined) {
					willDelete[level] = count;
				}
			}
			return { entity, id, name: root.name, willDelete };
		});
	}

	public listRegions(actor: ActorContext, query: RegionListQuery): Promise<PaginatedServiceResult<RegionListItem>> {
		return this.reads.read(actor, async (db): Promise<PaginatedServiceResult<RegionListItem>> => {
			const searchIds = await searchIdsFor(db, "Region", query.search);
			const include = parseInclude(query.include, REGION_INCLUDES);
			const result = await fetchListPage(query, {
				where: buildRegionListWhere(query, searchIds),
				order: buildListOrder(regionListQuery.resolveSort(query.sort), { columns: REGION_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
				keyset: geoIdKeyset<RegionListRow, Prisma.RegionWhereInput>((id) => ({ id: { gt: id } })),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.region.count({ where }),
				findMany: (args) => db.region.findMany({ ...args, ...(include === undefined ? {} : { include }) }),
			});
			return toPaginatedServiceResult(mapListResult(result, toRegionListItem), query);
		});
	}

	public getRegion(actor: ActorContext, id: number): Promise<Region | null> {
		return this.reads.read(actor, async (db): Promise<Region | null> => {
			const row = await db.region.findFirst({ where: { id, ...LIVE } });
			return row === null ? null : toRegionDto(row);
		});
	}

	public listSubregions(actor: ActorContext, query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>> {
		return this.reads.read(actor, async (db): Promise<PaginatedServiceResult<SubregionListItem>> => {
			const searchIds = await searchIdsFor(db, "Subregion", query.search);
			const include = parseInclude(query.include, SUBREGION_INCLUDES);
			const result = await fetchListPage(query, {
				where: buildSubregionListWhere(query, searchIds),
				order: buildListOrder(subregionListQuery.resolveSort(query.sort), {
					columns: SUBREGION_SORT_COLUMNS,
					tieBreaker: (direction) => ({ id: direction }),
					uniqueField: "id",
				}),
				keyset: geoIdKeyset<SubregionListRow, Prisma.SubregionWhereInput>((id) => ({ id: { gt: id } })),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.subregion.count({ where }),
				findMany: (args) => db.subregion.findMany({ ...args, ...(include === undefined ? {} : { include }) }),
			});
			return toPaginatedServiceResult(mapListResult(result, toSubregionListItem), query);
		});
	}

	public getSubregion(actor: ActorContext, id: number): Promise<Subregion | null> {
		return this.reads.read(actor, async (db): Promise<Subregion | null> => {
			const row = await db.subregion.findFirst({ where: { id, ...LIVE } });
			return row === null ? null : toSubregionDto(row);
		});
	}

	public listCountries(actor: ActorContext, query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>> {
		return this.reads.read(actor, async (db): Promise<PaginatedServiceResult<CountryListItem>> => {
			const searchIds = await searchIdsFor(db, "Country", query.search);
			const include = parseInclude(query.include, COUNTRY_INCLUDES);
			const result = await fetchListPage(query, {
				where: buildCountryListWhere(query, searchIds),
				order: buildListOrder(countryListQuery.resolveSort(query.sort), { columns: COUNTRY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
				keyset: geoIdKeyset<CountryListRow, Prisma.CountryWhereInput>((id) => ({ id: { gt: id } })),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.country.count({ where }),
				findMany: (args) => db.country.findMany({ ...args, ...(include === undefined ? {} : { include }) }),
			});
			return toPaginatedServiceResult(mapListResult(result, toCountryListItem), query);
		});
	}

	public getCountry(actor: ActorContext, id: number): Promise<Country | null> {
		return this.reads.read(actor, async (db): Promise<Country | null> => {
			const row = await db.country.findFirst({ where: { id, ...LIVE } });
			return row === null ? null : toCountryDto(row);
		});
	}

	public listStates(actor: ActorContext, query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>> {
		return this.reads.read(actor, async (db): Promise<PaginatedServiceResult<StateListItem>> => {
			const searchIds = await searchIdsFor(db, "State", query.search);
			const include = parseInclude(query.include, STATE_INCLUDES);
			const result = await fetchListPage(query, {
				where: buildStateListWhere(query, searchIds),
				order: buildListOrder(stateListQuery.resolveSort(query.sort), { columns: STATE_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
				keyset: geoIdKeyset<StateListRow, Prisma.StateWhereInput>((id) => ({ id: { gt: id } })),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.state.count({ where }),
				findMany: (args) => db.state.findMany({ ...args, ...(include === undefined ? {} : { include }) }),
			});
			return toPaginatedServiceResult(mapListResult(result, toStateListItem), query);
		});
	}

	public getState(actor: ActorContext, id: number): Promise<State | null> {
		return this.reads.read(actor, async (db): Promise<State | null> => {
			const row = await db.state.findFirst({ where: { id, ...LIVE } });
			return row === null ? null : toStateDto(row);
		});
	}

	public listCities(actor: ActorContext, query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>> {
		return this.reads.read(actor, async (db): Promise<PaginatedServiceResult<CityListItem>> => {
			const searchIds = await searchIdsFor(db, "City", query.search);
			const include = parseInclude(query.include, CITY_INCLUDES);
			const result = await fetchListPage(query, {
				where: buildCityListWhere(query, searchIds),
				order: buildListOrder(cityListQuery.resolveSort(query.sort), { columns: CITY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
				keyset: geoIdKeyset<CityListRow, Prisma.CityWhereInput>((id) => ({ id: { gt: id } })),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.city.count({ where }),
				findMany: (args) => db.city.findMany({ ...args, ...(include === undefined ? {} : { include }) }),
			});
			return toPaginatedServiceResult(mapListResult(result, toCityListItem), query);
		});
	}

	public getCity(actor: ActorContext, id: number): Promise<City | null> {
		return this.reads.read(actor, async (db): Promise<City | null> => {
			const row = await db.city.findFirst({ where: { id, ...LIVE } });
			return row === null ? null : toCityDto(row);
		});
	}
}
