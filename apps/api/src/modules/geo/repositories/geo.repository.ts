import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type {
	CascadePreviewResult,
	City,
	CityListItem,
	CityListQuery,
	CityListSortField,
	Country,
	CountryListItem,
	CountryListSortField,
	GeoAutocompleteItem,
	GeoImportResult,
	GeoImportValidationResult,
	GeoStats,
	MessageResponse,
	PaginatedServiceResult,
	Region,
	RegionListItem,
	RegionListSortField,
	State,
	StateListItem,
	StateListSortField,
	Subregion,
	SubregionListItem,
	SubregionListSortField,
	CountryListQuery,
	CreateCityInput,
	CreateCountryInput,
	CreateRegionInput,
	CreateStateInput,
	CreateSubregionInput,
	GeoAutocompleteQuery,
	GeoExportQuery,
	GeoImportInput,
	GeoImportValidateInput,
	CascadePreviewInput,
	JsonObject,
	RegionListQuery,
	StateListQuery,
	SubregionListQuery,
	UpdateCityInput,
	UpdateCountryInput,
	UpdateRegionInput,
	UpdateStateInput,
	UpdateSubregionInput,
} from "@workspace/shared";
import { cityListQuery, countryListQuery, JsonObjectSchema, regionListQuery, stateListQuery, subregionListQuery } from "@workspace/shared";
import type { City as CityRow, Country as CountryRow, Prisma, Region as RegionRow, State as StateRow, Subregion as SubregionRow } from "@prisma/client";

import { parsePrismaNullableDataValue } from "../../../common/utils/prisma-json";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { defineKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaBooleanFilter,
	toPrismaComparableFilter,
	toPrismaNullableComparableFilter,
	toPrismaNullableStringFilter,
	toPrismaStringFilter,
} from "../../../platform/persistence/list-query/prisma-filter";
import { PrismaService } from "../../../prisma/prisma.service";
import {
	toCityDto,
	toCityListItem,
	toNullableGeoNumber,
	toCountryDto,
	toCountryListItem,
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
} from "../mappers/geo.mappers";

/** Upper bound on fuzzy-search matches a geo list narrows to before filtering / paging. */
const GEO_SEARCH_MAX_MATCHES = 200;

/** Every geo list's default order is `id asc`, so its keyset is just the numeric id. */
const GeoIdPositionSchema = z.object({ id: z.number().int().nonnegative() }).strict();

function geoIdKeyset<TRow extends { readonly id: number }, TWhere>(after: (id: number) => TWhere): ListKeyset<TRow, TWhere> {
	return defineKeyset({
		position: GeoIdPositionSchema,
		read: (row: TRow) => ({ id: row.id }),
		after: (position) => after(position.id),
	});
}

// ── Sort columns (explicit API field → column mapping per entity) ──────────

const REGION_SORT_COLUMNS: SortColumns<RegionListSortField, Prisma.RegionOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
};

const SUBREGION_SORT_COLUMNS: SortColumns<SubregionListSortField, Prisma.SubregionOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
};

const COUNTRY_SORT_COLUMNS: SortColumns<CountryListSortField, Prisma.CountryOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
	iso2: (direction) => ({ iso2: direction }),
};

const STATE_SORT_COLUMNS: SortColumns<StateListSortField, Prisma.StateOrderByWithRelationInput> = {
	id: (direction) => ({ id: direction }),
	name: (direction) => ({ name: direction }),
	countryCode: (direction) => ({ countryCode: direction }),
	iso2: (direction) => ({ iso2: direction }),
};

const CITY_SORT_COLUMNS: SortColumns<CityListSortField, Prisma.CityOrderByWithRelationInput> = {
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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Sanitize a string value — strip HTML tags and trim. */
function sanitize(val: string | null | undefined): string | null {
	if (val === null || val === undefined) return null;
	return val.replace(/<[^>]*>/g, "").trim();
}

const geoNameFieldSchema = z.string();
const geoNonEmptyNameSchema = z.string().trim().min(1);
const geoNonNegativeIntSchema = z.number().int().nonnegative();

function sanitizePrismaNameField(input: { name?: string | null | undefined }): void {
	const parsed = geoNameFieldSchema.safeParse(input.name);
	if (parsed.success) {
		input.name = sanitize(parsed.data) ?? parsed.data;
	}
}

function parseImportName(row: JsonObject): string | null {
	const parsed = geoNameFieldSchema.safeParse(row.name);
	if (!parsed.success) {
		return null;
	}
	return sanitize(parsed.data);
}

function parseImportIntField(row: JsonObject, field: string): number | null {
	const parsed = geoNonNegativeIntSchema.safeParse(row[field]);
	return parsed.success ? parsed.data : null;
}

function parseImportStringField(row: JsonObject, field: string, fallback = ""): string {
	const parsed = geoNameFieldSchema.safeParse(row[field]);
	return parsed.success ? parsed.data : fallback;
}

// ── DTO → Prisma input mappers ────────────────────────────────────────────────
// Contract DTOs (zod outputs) carry scalar foreign keys and nullable `DataValue`
// JSON fields. Prisma's *Unchecked* inputs accept the scalar FKs directly, and
// JSON `null` must become the `DbNull` sentinel — `parsePrismaNullableDataValue`
// converts and runtime-validates it. Optional fields the caller did not supply
// are omitted (never passed as `undefined`), so Prisma leaves those columns
// untouched on update and applies the column default on create.

function toPrismaCreateRegion(input: CreateRegionInput): Prisma.RegionUncheckedCreateInput {
	return {
		name: input.name,
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
	};
}

function toPrismaUpdateRegion(input: UpdateRegionInput): Prisma.RegionUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
	};
}

function toPrismaCreateSubregion(input: CreateSubregionInput): Prisma.SubregionUncheckedCreateInput {
	return {
		name: input.name,
		regionId: input.regionId,
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
	};
}

function toPrismaUpdateSubregion(input: UpdateSubregionInput): Prisma.SubregionUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.regionId === undefined ? {} : { regionId: input.regionId }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
	};
}

function toPrismaCreateCountry(input: CreateCountryInput): Prisma.CountryUncheckedCreateInput {
	return {
		name: input.name,
		...(input.iso3 === undefined ? {} : { iso3: input.iso3 }),
		...(input.numericCode === undefined ? {} : { numericCode: input.numericCode }),
		...(input.iso2 === undefined ? {} : { iso2: input.iso2 }),
		...(input.phonecode === undefined ? {} : { phonecode: input.phonecode }),
		...(input.capital === undefined ? {} : { capital: input.capital }),
		...(input.currency === undefined ? {} : { currency: input.currency }),
		...(input.currencyName === undefined ? {} : { currencyName: input.currencyName }),
		...(input.currencySymbol === undefined ? {} : { currencySymbol: input.currencySymbol }),
		...(input.tld === undefined ? {} : { tld: input.tld }),
		...(input.native === undefined ? {} : { native: input.native }),
		...(input.population === undefined ? {} : { population: input.population }),
		...(input.gdp === undefined ? {} : { gdp: input.gdp }),
		...(input.region === undefined ? {} : { region: input.region }),
		...(input.subregion === undefined ? {} : { subregion: input.subregion }),
		...(input.nationality === undefined ? {} : { nationality: input.nationality }),
		...(input.timezones === undefined ? {} : { timezones: parsePrismaNullableDataValue(input.timezones) }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.latitude === undefined ? {} : { latitude: input.latitude }),
		...(input.longitude === undefined ? {} : { longitude: input.longitude }),
		...(input.emoji === undefined ? {} : { emoji: input.emoji }),
		...(input.emojiU === undefined ? {} : { emojiU: input.emojiU }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
		...(input.regionId === undefined ? {} : { regionId: input.regionId }),
		...(input.subregionId === undefined ? {} : { subregionId: input.subregionId }),
	};
}

function toPrismaUpdateCountry(input: UpdateCountryInput): Prisma.CountryUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.iso3 === undefined ? {} : { iso3: input.iso3 }),
		...(input.numericCode === undefined ? {} : { numericCode: input.numericCode }),
		...(input.iso2 === undefined ? {} : { iso2: input.iso2 }),
		...(input.phonecode === undefined ? {} : { phonecode: input.phonecode }),
		...(input.capital === undefined ? {} : { capital: input.capital }),
		...(input.currency === undefined ? {} : { currency: input.currency }),
		...(input.currencyName === undefined ? {} : { currencyName: input.currencyName }),
		...(input.currencySymbol === undefined ? {} : { currencySymbol: input.currencySymbol }),
		...(input.tld === undefined ? {} : { tld: input.tld }),
		...(input.native === undefined ? {} : { native: input.native }),
		...(input.population === undefined ? {} : { population: input.population }),
		...(input.gdp === undefined ? {} : { gdp: input.gdp }),
		...(input.region === undefined ? {} : { region: input.region }),
		...(input.subregion === undefined ? {} : { subregion: input.subregion }),
		...(input.nationality === undefined ? {} : { nationality: input.nationality }),
		...(input.timezones === undefined ? {} : { timezones: parsePrismaNullableDataValue(input.timezones) }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.latitude === undefined ? {} : { latitude: input.latitude }),
		...(input.longitude === undefined ? {} : { longitude: input.longitude }),
		...(input.emoji === undefined ? {} : { emoji: input.emoji }),
		...(input.emojiU === undefined ? {} : { emojiU: input.emojiU }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
		...(input.regionId === undefined ? {} : { regionId: input.regionId }),
		...(input.subregionId === undefined ? {} : { subregionId: input.subregionId }),
	};
}

function toPrismaCreateState(input: CreateStateInput): Prisma.StateUncheckedCreateInput {
	return {
		name: input.name,
		countryCode: input.countryCode,
		countryId: input.countryId,
		...(input.fipsCode === undefined ? {} : { fipsCode: input.fipsCode }),
		...(input.iso2 === undefined ? {} : { iso2: input.iso2 }),
		...(input.iso3166_2 === undefined ? {} : { iso3166_2: input.iso3166_2 }),
		...(input.type === undefined ? {} : { type: input.type }),
		...(input.level === undefined ? {} : { level: input.level }),
		...(input.parentId === undefined ? {} : { parentId: input.parentId }),
		...(input.native === undefined ? {} : { native: input.native }),
		...(input.latitude === undefined ? {} : { latitude: input.latitude }),
		...(input.longitude === undefined ? {} : { longitude: input.longitude }),
		...(input.timezone === undefined ? {} : { timezone: input.timezone }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
	};
}

function toPrismaUpdateState(input: UpdateStateInput): Prisma.StateUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.countryCode === undefined ? {} : { countryCode: input.countryCode }),
		...(input.countryId === undefined ? {} : { countryId: input.countryId }),
		...(input.fipsCode === undefined ? {} : { fipsCode: input.fipsCode }),
		...(input.iso2 === undefined ? {} : { iso2: input.iso2 }),
		...(input.iso3166_2 === undefined ? {} : { iso3166_2: input.iso3166_2 }),
		...(input.type === undefined ? {} : { type: input.type }),
		...(input.level === undefined ? {} : { level: input.level }),
		...(input.parentId === undefined ? {} : { parentId: input.parentId }),
		...(input.native === undefined ? {} : { native: input.native }),
		...(input.latitude === undefined ? {} : { latitude: input.latitude }),
		...(input.longitude === undefined ? {} : { longitude: input.longitude }),
		...(input.timezone === undefined ? {} : { timezone: input.timezone }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
	};
}

function toPrismaCreateCity(input: CreateCityInput): Prisma.CityUncheckedCreateInput {
	return {
		name: input.name,
		stateCode: input.stateCode,
		countryCode: input.countryCode,
		stateId: input.stateId,
		countryId: input.countryId,
		latitude: input.latitude,
		longitude: input.longitude,
		...(input.native === undefined ? {} : { native: input.native }),
		...(input.timezone === undefined ? {} : { timezone: input.timezone }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
	};
}

function toPrismaUpdateCity(input: UpdateCityInput): Prisma.CityUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.stateCode === undefined ? {} : { stateCode: input.stateCode }),
		...(input.countryCode === undefined ? {} : { countryCode: input.countryCode }),
		...(input.stateId === undefined ? {} : { stateId: input.stateId }),
		...(input.countryId === undefined ? {} : { countryId: input.countryId }),
		...(input.latitude === undefined ? {} : { latitude: input.latitude }),
		...(input.longitude === undefined ? {} : { longitude: input.longitude }),
		...(input.native === undefined ? {} : { native: input.native }),
		...(input.timezone === undefined ? {} : { timezone: input.timezone }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
	};
}

@Injectable()
export class GeoRepository {
	public constructor(private readonly prisma: PrismaService) {}

	// ── Fuzzy search ──────────────────────────────────────────────────

	/**
	 * Find IDs matching a search term using pg_trgm trigram similarity.
	 * Returns matching IDs ordered by relevance (most similar first).
	 * Falls back to ILIKE substring matching if pg_trgm returns no results.
	 */
	private async fuzzySearchIds(table: string, search: string, limit: number): Promise<number[]> {
		// Try trigram similarity first (requires pg_trgm extension)
		const trigramSql = `SELECT id, similarity(name, $1) AS similarity FROM ${table} WHERE name % $1 ORDER BY similarity DESC LIMIT $2`;
		const trigramResults: { readonly id: number; readonly similarity: number }[] = await this.prisma.$queryRawUnsafe(trigramSql, search, limit);

		if (trigramResults.length > 0) {
			return trigramResults.map((r) => r.id);
		}

		// Fallback to ILIKE substring match
		const likeSql = `SELECT id FROM ${table} WHERE name ILIKE $1 LIMIT $2`;
		const likeResults: { readonly id: number }[] = await this.prisma.$queryRawUnsafe(likeSql, `%${search}%`, limit);

		return likeResults.map((r) => r.id);
	}

	// ── Stats ──────────────────────────────────────────────────────────

	public async getStats(): Promise<GeoStats> {
		const [regions, subregions, countries, states, cities]: [number, number, number, number, number] = await Promise.all([
			this.prisma.region.count(),
			this.prisma.subregion.count(),
			this.prisma.country.count(),
			this.prisma.state.count(),
			this.prisma.city.count(),
		]);
		return { regions, subregions, countries, states, cities };
	}

	// ── Autocomplete ───────────────────────────────────────────────────

	public async autocomplete(query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		const { q, country, limit } = query;
		const like = `%${q}%`;
		const countryFilter = country ? { countryCode: country } : {};

		const [regions, subregions, countries, states, cities] = await Promise.all([
			this.prisma.region.findMany({ where: { name: { contains: like, mode: "insensitive" } }, take: limit }),
			this.prisma.subregion.findMany({ where: { name: { contains: like, mode: "insensitive" } }, take: limit }),
			this.prisma.country.findMany({ where: { name: { contains: like, mode: "insensitive" } }, take: limit }),
			this.prisma.state.findMany({ where: { name: { contains: like, mode: "insensitive" }, ...countryFilter }, take: limit }),
			this.prisma.city.findMany({ where: { name: { contains: like, mode: "insensitive" }, ...countryFilter }, take: limit }),
		]);

		const items: GeoAutocompleteItem[] = [];
		for (const r of regions) items.push({ id: r.id, name: r.name, entityType: "region", countryCode: null, stateCode: null, latitude: null, longitude: null, emoji: null });
		for (const s of subregions)
			items.push({ id: s.id, name: s.name, entityType: "subregion", countryCode: null, stateCode: null, latitude: null, longitude: null, emoji: null });
		for (const c of countries)
			items.push({
				id: c.id,
				name: c.name,
				entityType: "country",
				countryCode: c.iso2,
				stateCode: null,
				latitude: toNullableGeoNumber(c.latitude),
				longitude: toNullableGeoNumber(c.longitude),
				emoji: c.emoji,
			});
		for (const s of states)
			items.push({
				id: s.id,
				name: s.name,
				entityType: "state",
				countryCode: s.countryCode,
				stateCode: s.iso2,
				latitude: toNullableGeoNumber(s.latitude),
				longitude: toNullableGeoNumber(s.longitude),
				emoji: null,
			});
		for (const c of cities)
			items.push({
				id: c.id,
				name: c.name,
				entityType: "city",
				countryCode: c.countryCode,
				stateCode: c.stateCode,
				latitude: c.latitude.toNumber(),
				longitude: c.longitude.toNumber(),
				emoji: null,
			});

		return items.slice(0, limit);
	}

	// ── Region ──────────────────────────────────────────────────────────

	public async listRegions(query: RegionListQuery): Promise<PaginatedServiceResult<RegionListItem>> {
		const searchIds = query.search !== undefined ? await this.fuzzySearchIds("regions", query.search, GEO_SEARCH_MAX_MATCHES) : undefined;
		const includeObj = this.parseRegionInclude(query.include);
		const result = await fetchListPage(query, {
			where: buildRegionListWhere(query, searchIds),
			order: buildListOrder(regionListQuery.resolveSort(query.sort), { columns: REGION_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
			keyset: geoIdKeyset<RegionListRow, Prisma.RegionWhereInput>((id) => ({ id: { gt: id } })),
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.region.count({ where }),
			findMany: (args) => this.prisma.region.findMany({ ...args, ...(includeObj === undefined ? {} : { include: includeObj }) }),
		});
		return toPaginatedServiceResult(mapListResult(result, toRegionListItem), query);
	}

	public async getRegion(id: number): Promise<Region> {
		return toRegionDto(await this.findRegionOrThrow(id));
	}

	private async findRegionOrThrow(id: number): Promise<RegionRow> {
		const region = await this.prisma.region.findUnique({ where: { id } });
		if (region === null) throw new NotFoundException(`Region #${String(id)} not found`);
		return region;
	}

	public async createRegion(input: CreateRegionInput): Promise<Region> {
		if (input.name) sanitizePrismaNameField(input);
		return toRegionDto(await this.prisma.region.create({ data: toPrismaCreateRegion(input) }));
	}

	public async updateRegion(id: number, input: UpdateRegionInput): Promise<Region> {
		await this.findRegionOrThrow(id);
		sanitizePrismaNameField(input);
		return toRegionDto(await this.prisma.region.update({ where: { id }, data: toPrismaUpdateRegion(input) }));
	}

	public async deleteRegion(id: number): Promise<MessageResponse> {
		await this.findRegionOrThrow(id);
		await this.prisma.region.delete({ where: { id } });
		return { message: `Region #${String(id)} deleted` };
	}

	// ── Subregion ───────────────────────────────────────────────────────

	public async listSubregions(query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>> {
		const searchIds = query.search !== undefined ? await this.fuzzySearchIds("subregions", query.search, GEO_SEARCH_MAX_MATCHES) : undefined;
		const includeObj = this.parseSubregionInclude(query.include);
		const result = await fetchListPage(query, {
			where: buildSubregionListWhere(query, searchIds),
			order: buildListOrder(subregionListQuery.resolveSort(query.sort), {
				columns: SUBREGION_SORT_COLUMNS,
				tieBreaker: (direction) => ({ id: direction }),
				uniqueField: "id",
			}),
			keyset: geoIdKeyset<SubregionListRow, Prisma.SubregionWhereInput>((id) => ({ id: { gt: id } })),
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.subregion.count({ where }),
			findMany: (args) => this.prisma.subregion.findMany({ ...args, ...(includeObj === undefined ? {} : { include: includeObj }) }),
		});
		return toPaginatedServiceResult(mapListResult(result, toSubregionListItem), query);
	}

	public async getSubregion(id: number): Promise<Subregion> {
		return toSubregionDto(await this.findSubregionOrThrow(id));
	}

	private async findSubregionOrThrow(id: number): Promise<SubregionRow> {
		const subregion = await this.prisma.subregion.findUnique({ where: { id } });
		if (subregion === null) throw new NotFoundException(`Subregion #${String(id)} not found`);
		return subregion;
	}

	public async createSubregion(input: CreateSubregionInput): Promise<Subregion> {
		if (input.name) sanitizePrismaNameField(input);
		return toSubregionDto(await this.prisma.subregion.create({ data: toPrismaCreateSubregion(input) }));
	}

	public async updateSubregion(id: number, input: UpdateSubregionInput): Promise<Subregion> {
		await this.findSubregionOrThrow(id);
		sanitizePrismaNameField(input);
		return toSubregionDto(await this.prisma.subregion.update({ where: { id }, data: toPrismaUpdateSubregion(input) }));
	}

	public async deleteSubregion(id: number): Promise<MessageResponse> {
		await this.findSubregionOrThrow(id);
		await this.prisma.subregion.delete({ where: { id } });
		return { message: `Subregion #${String(id)} deleted` };
	}

	// ── Country ─────────────────────────────────────────────────────────

	public async listCountries(query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>> {
		const searchIds = query.search !== undefined ? await this.fuzzySearchIds("countries", query.search, GEO_SEARCH_MAX_MATCHES) : undefined;
		const includeObj = this.parseCountryInclude(query.include);
		const result = await fetchListPage(query, {
			where: buildCountryListWhere(query, searchIds),
			order: buildListOrder(countryListQuery.resolveSort(query.sort), { columns: COUNTRY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
			keyset: geoIdKeyset<CountryListRow, Prisma.CountryWhereInput>((id) => ({ id: { gt: id } })),
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.country.count({ where }),
			findMany: (args) => this.prisma.country.findMany({ ...args, ...(includeObj === undefined ? {} : { include: includeObj }) }),
		});
		return toPaginatedServiceResult(mapListResult(result, toCountryListItem), query);
	}

	public async getCountry(id: number): Promise<Country> {
		return toCountryDto(await this.findCountryOrThrow(id));
	}

	private async findCountryOrThrow(id: number): Promise<CountryRow> {
		const country = await this.prisma.country.findUnique({ where: { id } });
		if (country === null) throw new NotFoundException(`Country #${String(id)} not found`);
		return country;
	}

	public async createCountry(input: CreateCountryInput): Promise<Country> {
		if (input.name) sanitizePrismaNameField(input);
		return toCountryDto(await this.prisma.country.create({ data: toPrismaCreateCountry(input) }));
	}

	public async updateCountry(id: number, input: UpdateCountryInput): Promise<Country> {
		await this.findCountryOrThrow(id);
		sanitizePrismaNameField(input);
		return toCountryDto(await this.prisma.country.update({ where: { id }, data: toPrismaUpdateCountry(input) }));
	}

	public async deleteCountry(id: number): Promise<MessageResponse> {
		await this.findCountryOrThrow(id);
		await this.prisma.country.delete({ where: { id } });
		return { message: `Country #${String(id)} deleted` };
	}

	// ── State ───────────────────────────────────────────────────────────

	public async listStates(query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>> {
		const searchIds = query.search !== undefined ? await this.fuzzySearchIds("states", query.search, GEO_SEARCH_MAX_MATCHES) : undefined;
		const includeObj = this.parseStateInclude(query.include);
		const result = await fetchListPage(query, {
			where: buildStateListWhere(query, searchIds),
			order: buildListOrder(stateListQuery.resolveSort(query.sort), { columns: STATE_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
			keyset: geoIdKeyset<StateListRow, Prisma.StateWhereInput>((id) => ({ id: { gt: id } })),
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.state.count({ where }),
			findMany: (args) => this.prisma.state.findMany({ ...args, ...(includeObj === undefined ? {} : { include: includeObj }) }),
		});
		return toPaginatedServiceResult(mapListResult(result, toStateListItem), query);
	}

	public async getState(id: number): Promise<State> {
		return toStateDto(await this.findStateOrThrow(id));
	}

	private async findStateOrThrow(id: number): Promise<StateRow> {
		const state = await this.prisma.state.findUnique({ where: { id } });
		if (state === null) throw new NotFoundException(`State #${String(id)} not found`);
		return state;
	}

	public async createState(input: CreateStateInput): Promise<State> {
		if (input.name) sanitizePrismaNameField(input);
		return toStateDto(await this.prisma.state.create({ data: toPrismaCreateState(input) }));
	}

	public async updateState(id: number, input: UpdateStateInput): Promise<State> {
		await this.findStateOrThrow(id);
		sanitizePrismaNameField(input);
		return toStateDto(await this.prisma.state.update({ where: { id }, data: toPrismaUpdateState(input) }));
	}

	public async deleteState(id: number): Promise<MessageResponse> {
		await this.findStateOrThrow(id);
		await this.prisma.state.delete({ where: { id } });
		return { message: `State #${String(id)} deleted` };
	}

	// ── City ────────────────────────────────────────────────────────────

	public async listCities(query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>> {
		const searchIds = query.search !== undefined ? await this.fuzzySearchIds("cities", query.search, GEO_SEARCH_MAX_MATCHES) : undefined;
		const includeObj = this.parseCityInclude(query.include);
		const result = await fetchListPage(query, {
			where: buildCityListWhere(query, searchIds),
			order: buildListOrder(cityListQuery.resolveSort(query.sort), { columns: CITY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }), uniqueField: "id" }),
			keyset: geoIdKeyset<CityListRow, Prisma.CityWhereInput>((id) => ({ id: { gt: id } })),
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.city.count({ where }),
			findMany: (args) => this.prisma.city.findMany({ ...args, ...(includeObj === undefined ? {} : { include: includeObj }) }),
		});
		return toPaginatedServiceResult(mapListResult(result, toCityListItem), query);
	}

	public async getCity(id: number): Promise<City> {
		return toCityDto(await this.findCityOrThrow(id));
	}

	private async findCityOrThrow(id: number): Promise<CityRow> {
		const city = await this.prisma.city.findUnique({ where: { id } });
		if (city === null) throw new NotFoundException(`City #${String(id)} not found`);
		return city;
	}

	public async createCity(input: CreateCityInput): Promise<City> {
		if (input.name) sanitizePrismaNameField(input);
		return toCityDto(await this.prisma.city.create({ data: toPrismaCreateCity(input) }));
	}

	public async updateCity(id: number, input: UpdateCityInput): Promise<City> {
		await this.findCityOrThrow(id);
		sanitizePrismaNameField(input);
		return toCityDto(await this.prisma.city.update({ where: { id }, data: toPrismaUpdateCity(input) }));
	}

	public async deleteCity(id: number): Promise<MessageResponse> {
		await this.findCityOrThrow(id);
		await this.prisma.city.delete({ where: { id } });
		return { message: `City #${String(id)} deleted` };
	}

	// ── Import ──────────────────────────────────────────────────────────

	public async importData(input: GeoImportInput): Promise<GeoImportResult> {
		const { entity, data, upsert } = input;
		let created = 0;
		let updated = 0;
		let skipped = 0;
		const errors: { row: number; message: string }[] = [];

		for (let i = 0; i < data.length; i++) {
			const row = JsonObjectSchema.parse(data[i]);
			try {
				const result = await this.importRow(entity, row, upsert);
				if (result === "created") created++;
				else if (result === "updated") updated++;
				else skipped++;
			} catch (err) {
				errors.push({ row: i + 1, message: err instanceof Error ? err.message : "Unknown error" });
			}
		}

		return { created, updated, skipped, errors };
	}

	public validateImport(input: GeoImportValidateInput): GeoImportValidationResult {
		const { entity, data } = input;
		const errors: { row: number; field: string | null; message: string }[] = [];
		let validRows = 0;

		for (let i = 0; i < data.length; i++) {
			const row = JsonObjectSchema.parse(data[i]);
			const rowErrors = this.validateRow(entity, row);
			if (rowErrors.length === 0) {
				validRows++;
			} else {
				errors.push(...rowErrors.map((e) => ({ row: i + 1, ...e })));
			}
		}

		return { valid: errors.length === 0, totalRows: data.length, validRows, errors };
	}

	// ── Export ──────────────────────────────────────────────────────────

	public async exportData(query: GeoExportQuery): Promise<readonly City[]> {
		const { countryCode, regionId } = query;

		// Export countries filtered, and cascade their states/cities
		const countryWhere: Prisma.CountryWhereInput = {
			...(countryCode !== undefined ? { iso2: countryCode } : {}),
			...(regionId !== undefined ? { regionId } : {}),
		};
		const countries = await this.prisma.country.findMany({ where: countryWhere, orderBy: { name: "asc" } });
		if (countries.length === 0) return [];

		const countryIds = countries.map((c) => c.id);

		const states = await this.prisma.state.findMany({ where: { countryId: { in: countryIds } }, orderBy: { name: "asc" } });
		const stateIds = states.map((s) => s.id);

		const cities = await this.prisma.city.findMany({ where: { stateId: { in: stateIds } }, orderBy: { name: "asc" } });

		// The flat city rows ARE the export (see `GeoExportResponseSchema`).
		return cities.map(toCityDto);
	}

	// ── Cascade Preview ─────────────────────────────────────────────────

	public async cascadePreview(input: CascadePreviewInput): Promise<CascadePreviewResult> {
		const { entity, id } = input;

		if (entity === "region") {
			const region = await this.prisma.region.findUnique({ where: { id } });
			if (region === null) throw new NotFoundException(`Region #${String(id)} not found`);
			const [subregions, countries, states, cities] = await Promise.all([
				this.prisma.subregion.count({ where: { regionId: id } }),
				this.prisma.country.count({ where: { regionId: id } }),
				this.prisma.state.findMany({ where: { country: { regionId: id } } }).then((s) => s.length),
				this.prisma.city.count({ where: { state: { country: { regionId: id } } } }),
			]);
			return { entity: "region", id, name: region.name, willDelete: { subregions, countries, states, cities } };
		}

		if (entity === "subregion") {
			const subregion = await this.prisma.subregion.findUnique({ where: { id } });
			if (subregion === null) throw new NotFoundException(`Subregion #${String(id)} not found`);
			const [countries, states, cities] = await Promise.all([
				this.prisma.country.count({ where: { subregionId: id } }),
				this.prisma.state.findMany({ where: { country: { subregionId: id } } }).then((s) => s.length),
				this.prisma.city.count({ where: { state: { country: { subregionId: id } } } }),
			]);
			return { entity: "subregion", id, name: subregion.name, willDelete: { countries, states, cities } };
		}

		if (entity === "country") {
			const country = await this.prisma.country.findUnique({ where: { id } });
			if (country === null) throw new NotFoundException(`Country #${String(id)} not found`);
			const [states, cities] = await Promise.all([this.prisma.state.count({ where: { countryId: id } }), this.prisma.city.count({ where: { countryId: id } })]);
			return { entity: "country", id, name: country.name, willDelete: { states, cities } };
		}

		// entity === "state"
		const state = await this.prisma.state.findUnique({ where: { id } });
		if (state === null) throw new NotFoundException(`State #${String(id)} not found`);
		const cities = await this.prisma.city.count({ where: { stateId: id } });
		return { entity: "state", id, name: state.name, willDelete: { cities } };
	}

	// ── Private helpers ─────────────────────────────────────────────────

	private parseRegionInclude(include: string | undefined): Prisma.RegionInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.RegionInclude = {};
		if (parts.includes("subregions")) result.subregions = true;
		if (parts.includes("countries")) result.countries = true;
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseSubregionInclude(include: string | undefined): Prisma.SubregionInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.SubregionInclude = {};
		if (parts.includes("region")) result.region = true;
		if (parts.includes("countries")) result.countries = true;
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseCountryInclude(include: string | undefined): Prisma.CountryInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.CountryInclude = {};
		if (parts.includes("region")) result.regionRelation = true;
		if (parts.includes("subregion")) result.subregionRelation = true;
		if (parts.includes("states")) result.states = true;
		if (parts.includes("cities")) result.cities = true;
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseStateInclude(include: string | undefined): Prisma.StateInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.StateInclude = {};
		if (parts.includes("country")) result.country = true;
		if (parts.includes("cities")) result.cities = true;
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseCityInclude(include: string | undefined): Prisma.CityInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.CityInclude = {};
		if (parts.includes("state")) result.state = true;
		if (parts.includes("country")) result.country = true;
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private async importRow(entity: string, row: JsonObject, upsert: boolean): Promise<"created" | "updated" | "skipped"> {
		const name = parseImportName(row);
		if (name === null) throw new Error("name is required");

		switch (entity) {
			case "region": {
				if (upsert) {
					const existing = await this.prisma.region.findFirst({ where: { name } });
					if (existing) {
						await this.prisma.region.update({ where: { id: existing.id }, data: { name } });
						return "updated";
					}
				}
				await this.prisma.region.create({ data: { name } });
				return "created";
			}
			case "subregion": {
				const regionId = parseImportIntField(row, "regionId");
				if (regionId === null) throw new Error("regionId is required");
				if (upsert) {
					const existing = await this.prisma.subregion.findFirst({ where: { name, regionId } });
					if (existing) {
						await this.prisma.subregion.update({ where: { id: existing.id }, data: { name } });
						return "updated";
					}
				}
				await this.prisma.subregion.create({ data: { name, regionId } });
				return "created";
			}
			case "country": {
				if (upsert) {
					const existing = await this.prisma.country.findFirst({ where: { name } });
					if (existing) {
						await this.prisma.country.update({ where: { id: existing.id }, data: { name } });
						return "updated";
					}
				}
				await this.prisma.country.create({ data: { name } });
				return "created";
			}
			case "state": {
				const countryCode = parseImportStringField(row, "countryCode");
				const countryId = parseImportIntField(row, "countryId");
				if (countryId === null) throw new Error("countryId is required");
				if (upsert) {
					const existing = await this.prisma.state.findFirst({ where: { name, countryId } });
					if (existing) {
						await this.prisma.state.update({ where: { id: existing.id }, data: { name } });
						return "updated";
					}
				}
				await this.prisma.state.create({ data: { name, countryCode, countryId } });
				return "created";
			}
			case "city": {
				const stateId = parseImportIntField(row, "stateId");
				const countryId = parseImportIntField(row, "countryId");
				const stateCode = parseImportStringField(row, "stateCode");
				const countryCode = parseImportStringField(row, "countryCode");
				if (stateId === null || countryId === null) throw new Error("stateId and countryId are required");
				if (upsert) {
					const existing = await this.prisma.city.findFirst({ where: { name, stateId } });
					if (existing) {
						await this.prisma.city.update({ where: { id: existing.id }, data: { name } });
						return "updated";
					}
				}
				await this.prisma.city.create({ data: { name, stateCode, countryCode, latitude: 0, longitude: 0, stateId, countryId } });
				return "created";
			}
			default:
				throw new Error(`Unknown entity: ${entity}`);
		}
	}

	private validateRow(entity: string, row: JsonObject): readonly { readonly field: string | null; readonly message: string }[] {
		const errors: { field: string | null; message: string }[] = [];
		if (!geoNonEmptyNameSchema.safeParse(row.name).success) {
			errors.push({ field: "name", message: "name is required and must be a non-empty string" });
		}
		if (entity === "subregion" && !geoNonNegativeIntSchema.safeParse(row.regionId).success) {
			errors.push({ field: "regionId", message: "regionId is required and must be a non-negative integer" });
		}
		if (entity === "state" && !geoNonNegativeIntSchema.safeParse(row.countryId).success) {
			errors.push({ field: "countryId", message: "countryId is required and must be a non-negative integer" });
		}
		if (entity === "city") {
			if (!geoNonNegativeIntSchema.safeParse(row.stateId).success) errors.push({ field: "stateId", message: "stateId is required" });
			if (!geoNonNegativeIntSchema.safeParse(row.countryId).success) errors.push({ field: "countryId", message: "countryId is required" });
		}
		return errors;
	}
}
