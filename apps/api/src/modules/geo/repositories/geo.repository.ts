import { Injectable } from "@nestjs/common";
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
import { ApiErrorCodes, cityListQuery, countryListQuery, regionListQuery, stateListQuery, subregionListQuery } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { NotFoundError, ValidationError } from "../../../common/errors/app-error";
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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip HTML tags and trim a free-text name. */
function sanitizeName(value: string): string {
	return value.replace(/<[^>]*>/g, "").trim();
}

/** A create/update input with its `name` (when present) sanitized — a NEW object, the input is never mutated. */
function withSanitizedName<TInput extends { readonly name?: string | undefined }>(input: TInput): TInput {
	return input.name === undefined ? input : { ...input, name: sanitizeName(input.name) };
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

// ── Import row contracts (zod — the import payload is untrusted JSON) ───────

/** Longest geo name the columns accept (`VarChar(255)`). */
const GEO_NAME_MAX_LENGTH = 255;
/** ISO 3166-1 alpha-2 country codes are two characters (`VarChar(2)`). */
const COUNTRY_CODE_MAX_LENGTH = 2;
/** City state codes (`VarChar(255)`). */
const STATE_CODE_MAX_LENGTH = 255;

const ImportNameSchema = z.string().transform(sanitizeName).pipe(z.string().min(1).max(GEO_NAME_MAX_LENGTH));
const ImportIdSchema = z.number().int().nonnegative();

const RegionImportRowSchema = z.looseObject({ name: ImportNameSchema });
const SubregionImportRowSchema = z.looseObject({ name: ImportNameSchema, regionId: ImportIdSchema });
const CountryImportRowSchema = z.looseObject({ name: ImportNameSchema });
const StateImportRowSchema = z.looseObject({
	name: ImportNameSchema,
	countryId: ImportIdSchema,
	countryCode: z.string().max(COUNTRY_CODE_MAX_LENGTH).default(""),
});
const CityImportRowSchema = z.looseObject({
	name: ImportNameSchema,
	stateId: ImportIdSchema,
	countryId: ImportIdSchema,
	stateCode: z.string().max(STATE_CODE_MAX_LENGTH).default(""),
	countryCode: z.string().max(COUNTRY_CODE_MAX_LENGTH).default(""),
});

/** One validated import row, discriminated by entity. */
type GeoImportRow =
	| { readonly entity: "region"; readonly row: z.output<typeof RegionImportRowSchema> }
	| { readonly entity: "subregion"; readonly row: z.output<typeof SubregionImportRowSchema> }
	| { readonly entity: "country"; readonly row: z.output<typeof CountryImportRowSchema> }
	| { readonly entity: "state"; readonly row: z.output<typeof StateImportRowSchema> }
	| { readonly entity: "city"; readonly row: z.output<typeof CityImportRowSchema> };

type GeoImportEntity = GeoImportInput["entity"];

/** A row-level validation problem (1-based row number, offending field). */
interface GeoRowIssue {
	readonly field: string | null;
	readonly message: string;
}

type ParsedImportRow = { readonly ok: true; readonly value: GeoImportRow } | { readonly ok: false; readonly issues: readonly GeoRowIssue[] };

function issuesOf(error: z.ZodError): GeoRowIssue[] {
	return error.issues.map((issue): GeoRowIssue => {
		const [first] = issue.path;
		return { field: typeof first === "string" ? first : null, message: issue.message };
	});
}

function parseImportRow(entity: GeoImportEntity, row: JsonObject): ParsedImportRow {
	switch (entity) {
		case "region": {
			const parsed = RegionImportRowSchema.safeParse(row);
			return parsed.success ? { ok: true, value: { entity, row: parsed.data } } : { ok: false, issues: issuesOf(parsed.error) };
		}
		case "subregion": {
			const parsed = SubregionImportRowSchema.safeParse(row);
			return parsed.success ? { ok: true, value: { entity, row: parsed.data } } : { ok: false, issues: issuesOf(parsed.error) };
		}
		case "country": {
			const parsed = CountryImportRowSchema.safeParse(row);
			return parsed.success ? { ok: true, value: { entity, row: parsed.data } } : { ok: false, issues: issuesOf(parsed.error) };
		}
		case "state": {
			const parsed = StateImportRowSchema.safeParse(row);
			return parsed.success ? { ok: true, value: { entity, row: parsed.data } } : { ok: false, issues: issuesOf(parsed.error) };
		}
		case "city": {
			const parsed = CityImportRowSchema.safeParse(row);
			return parsed.success ? { ok: true, value: { entity, row: parsed.data } } : { ok: false, issues: issuesOf(parsed.error) };
		}
		default:
			return assertNever(entity);
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled geo import entity: ${JSON.stringify(value)}`);
}

/**
 * Key every import entity is matched on for `upsert` (its natural key: the
 * name within its parent). Rows with the same key in one import refer to the
 * same reference row.
 */
function naturalKey(row: GeoImportRow): string {
	switch (row.entity) {
		case "region":
		case "country":
			return row.row.name;
		case "subregion":
			return `${String(row.row.regionId)}:${row.row.name}`;
		case "state":
			return `${String(row.row.countryId)}:${row.row.name}`;
		case "city":
			return `${String(row.row.stateId)}:${row.row.name}`;
		default:
			return assertNever(row);
	}
}

/** Advisory-lock key serializing geo imports (`pg_advisory_xact_lock(hashtext(...))`). */
const GEO_IMPORT_LOCK_KEY = "geo.reference_data.import";

/** Rows per INSERT statement during an import. */
const GEO_IMPORT_INSERT_CHUNK_SIZE = 1_000;

/** Transaction client of a `geo.reference_data.write` system operation. */
export type GeoWriteTransaction = Pick<Prisma.TransactionClient, "region" | "subregion" | "country" | "state" | "city" | "$executeRaw">;

/** Who soft-deleted a row, and when (epoch ms). */
export interface GeoDeletionStamp {
	readonly deletedBy: string;
	readonly deletedAt: number;
}

function softDeleteData(stamp: GeoDeletionStamp): { isDeleted: true; deletedAt: bigint; deletedBy: string } {
	return { isDeleted: true, deletedAt: BigInt(stamp.deletedAt), deletedBy: stamp.deletedBy };
}

function notFound(entity: string, id: number): NotFoundError {
	return new NotFoundError({ message: `${entity} #${String(id)} not found` });
}

/** A body that references a parent row which does not exist (or was soft-deleted). */
function missingParent(field: string, entity: string, id: number): ValidationError {
	return new ValidationError({
		message: `${field} does not reference an existing ${entity}`,
		details: { issues: [{ path: field, message: `${entity} #${String(id)} does not exist`, code: ApiErrorCodes.VALIDATION_ERROR }] },
	});
}

/**
 * Geo reference data. Reads go through the shared pool (world-readable RLS
 * policy) and always exclude soft-deleted rows. Writes take a transaction
 * client of the `geo.reference_data.write` system operation (opened by
 * `GeoService`) — the only session the `*_write` RLS policies accept. Rows are
 * never hard-deleted: a delete soft-deletes the row and, in the same
 * transaction, everything `cascadePreview` reports under it.
 */
@Injectable()
export class GeoRepository {
	public constructor(private readonly prisma: PrismaService) {}

	// ── Fuzzy search ──────────────────────────────────────────────────

	/**
	 * Find live IDs matching a search term using pg_trgm trigram similarity,
	 * most similar first; falls back to ILIKE substring matching when the
	 * trigram index finds nothing. `table` is one of the five geo tables
	 * (a closed union), never caller input.
	 */
	private async fuzzySearchIds(table: "regions" | "subregions" | "countries" | "states" | "cities", search: string, limit: number): Promise<number[]> {
		const trigramSql = `SELECT id, similarity(name, $1) AS similarity FROM ${table} WHERE is_deleted = false AND name % $1 ORDER BY similarity DESC LIMIT $2`;
		const trigramResults: { readonly id: number; readonly similarity: number }[] = await this.prisma.$queryRawUnsafe(trigramSql, search, limit);

		if (trigramResults.length > 0) {
			return trigramResults.map((r) => r.id);
		}

		const likeSql = `SELECT id FROM ${table} WHERE is_deleted = false AND name ILIKE $1 LIMIT $2`;
		const likeResults: { readonly id: number }[] = await this.prisma.$queryRawUnsafe(likeSql, `%${search}%`, limit);

		return likeResults.map((r) => r.id);
	}

	// ── Stats ──────────────────────────────────────────────────────────

	public async getStats(): Promise<GeoStats> {
		const live = { where: { isDeleted: false } };
		const [regions, subregions, countries, states, cities]: [number, number, number, number, number] = await Promise.all([
			this.prisma.region.count(live),
			this.prisma.subregion.count(live),
			this.prisma.country.count(live),
			this.prisma.state.count(live),
			this.prisma.city.count(live),
		]);
		return { regions, subregions, countries, states, cities };
	}

	// ── Autocomplete ───────────────────────────────────────────────────

	public async autocomplete(query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		const { q, country, limit } = query;
		const nameMatch = { contains: q, mode: "insensitive" } satisfies Prisma.StringFilter;
		const countryFilter = country ? { countryCode: country } : {};

		const [regions, subregions, countries, states, cities] = await Promise.all([
			this.prisma.region.findMany({ where: { isDeleted: false, name: nameMatch }, take: limit }),
			this.prisma.subregion.findMany({ where: { isDeleted: false, name: nameMatch }, take: limit }),
			this.prisma.country.findMany({ where: { isDeleted: false, name: nameMatch }, take: limit }),
			this.prisma.state.findMany({ where: { isDeleted: false, name: nameMatch, ...countryFilter }, take: limit }),
			this.prisma.city.findMany({ where: { isDeleted: false, name: nameMatch, ...countryFilter }, take: limit }),
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
		const region = await this.prisma.region.findFirst({ where: { id, isDeleted: false } });
		if (region === null) throw notFound("Region", id);
		return toRegionDto(region);
	}

	public async createRegion(tx: GeoWriteTransaction, input: CreateRegionInput): Promise<Region> {
		return toRegionDto(await tx.region.create({ data: toPrismaCreateRegion(withSanitizedName(input)) }));
	}

	public async updateRegion(tx: GeoWriteTransaction, id: number, input: UpdateRegionInput): Promise<Region> {
		const updated = await tx.region.updateMany({ where: { id, isDeleted: false }, data: toPrismaUpdateRegion(withSanitizedName(input)) });
		if (updated.count === 0) throw notFound("Region", id);
		return toRegionDto(await tx.region.findUniqueOrThrow({ where: { id } }));
	}

	/** Soft-delete a region and, in the same transaction, its subregions, countries, their states and cities. */
	public async deleteRegion(tx: GeoWriteTransaction, id: number, stamp: GeoDeletionStamp): Promise<MessageResponse> {
		const deleted = await tx.region.updateMany({ where: { id, isDeleted: false }, data: softDeleteData(stamp) });
		if (deleted.count === 0) throw notFound("Region", id);
		await tx.city.updateMany({ where: { isDeleted: false, state: { country: { regionId: id } } }, data: softDeleteData(stamp) });
		await tx.state.updateMany({ where: { isDeleted: false, country: { regionId: id } }, data: softDeleteData(stamp) });
		await tx.country.updateMany({ where: { isDeleted: false, regionId: id }, data: softDeleteData(stamp) });
		await tx.subregion.updateMany({ where: { isDeleted: false, regionId: id }, data: softDeleteData(stamp) });
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
		const subregion = await this.prisma.subregion.findFirst({ where: { id, isDeleted: false } });
		if (subregion === null) throw notFound("Subregion", id);
		return toSubregionDto(subregion);
	}

	public async createSubregion(tx: GeoWriteTransaction, input: CreateSubregionInput): Promise<Subregion> {
		await this.assertLiveRegion(tx, "regionId", input.regionId);
		return toSubregionDto(await tx.subregion.create({ data: toPrismaCreateSubregion(withSanitizedName(input)) }));
	}

	public async updateSubregion(tx: GeoWriteTransaction, id: number, input: UpdateSubregionInput): Promise<Subregion> {
		if (input.regionId !== undefined) await this.assertLiveRegion(tx, "regionId", input.regionId);
		const updated = await tx.subregion.updateMany({ where: { id, isDeleted: false }, data: toPrismaUpdateSubregion(withSanitizedName(input)) });
		if (updated.count === 0) throw notFound("Subregion", id);
		return toSubregionDto(await tx.subregion.findUniqueOrThrow({ where: { id } }));
	}

	/** Soft-delete a subregion and, in the same transaction, its countries, their states and cities. */
	public async deleteSubregion(tx: GeoWriteTransaction, id: number, stamp: GeoDeletionStamp): Promise<MessageResponse> {
		const deleted = await tx.subregion.updateMany({ where: { id, isDeleted: false }, data: softDeleteData(stamp) });
		if (deleted.count === 0) throw notFound("Subregion", id);
		await tx.city.updateMany({ where: { isDeleted: false, state: { country: { subregionId: id } } }, data: softDeleteData(stamp) });
		await tx.state.updateMany({ where: { isDeleted: false, country: { subregionId: id } }, data: softDeleteData(stamp) });
		await tx.country.updateMany({ where: { isDeleted: false, subregionId: id }, data: softDeleteData(stamp) });
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
		const country = await this.prisma.country.findFirst({ where: { id, isDeleted: false } });
		if (country === null) throw notFound("Country", id);
		return toCountryDto(country);
	}

	public async createCountry(tx: GeoWriteTransaction, input: CreateCountryInput): Promise<Country> {
		await this.assertCountryParents(tx, input.regionId, input.subregionId);
		return toCountryDto(await tx.country.create({ data: toPrismaCreateCountry(withSanitizedName(input)) }));
	}

	public async updateCountry(tx: GeoWriteTransaction, id: number, input: UpdateCountryInput): Promise<Country> {
		await this.assertCountryParents(tx, input.regionId, input.subregionId);
		const updated = await tx.country.updateMany({ where: { id, isDeleted: false }, data: toPrismaUpdateCountry(withSanitizedName(input)) });
		if (updated.count === 0) throw notFound("Country", id);
		return toCountryDto(await tx.country.findUniqueOrThrow({ where: { id } }));
	}

	/** Soft-delete a country and, in the same transaction, its states and cities. */
	public async deleteCountry(tx: GeoWriteTransaction, id: number, stamp: GeoDeletionStamp): Promise<MessageResponse> {
		const deleted = await tx.country.updateMany({ where: { id, isDeleted: false }, data: softDeleteData(stamp) });
		if (deleted.count === 0) throw notFound("Country", id);
		await tx.city.updateMany({ where: { isDeleted: false, countryId: id }, data: softDeleteData(stamp) });
		await tx.state.updateMany({ where: { isDeleted: false, countryId: id }, data: softDeleteData(stamp) });
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
		const state = await this.prisma.state.findFirst({ where: { id, isDeleted: false } });
		if (state === null) throw notFound("State", id);
		return toStateDto(state);
	}

	public async createState(tx: GeoWriteTransaction, input: CreateStateInput): Promise<State> {
		await this.assertLiveCountry(tx, "countryId", input.countryId);
		return toStateDto(await tx.state.create({ data: toPrismaCreateState(withSanitizedName(input)) }));
	}

	public async updateState(tx: GeoWriteTransaction, id: number, input: UpdateStateInput): Promise<State> {
		if (input.countryId !== undefined) await this.assertLiveCountry(tx, "countryId", input.countryId);
		const updated = await tx.state.updateMany({ where: { id, isDeleted: false }, data: toPrismaUpdateState(withSanitizedName(input)) });
		if (updated.count === 0) throw notFound("State", id);
		return toStateDto(await tx.state.findUniqueOrThrow({ where: { id } }));
	}

	/** Soft-delete a state and, in the same transaction, its cities. */
	public async deleteState(tx: GeoWriteTransaction, id: number, stamp: GeoDeletionStamp): Promise<MessageResponse> {
		const deleted = await tx.state.updateMany({ where: { id, isDeleted: false }, data: softDeleteData(stamp) });
		if (deleted.count === 0) throw notFound("State", id);
		await tx.city.updateMany({ where: { isDeleted: false, stateId: id }, data: softDeleteData(stamp) });
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
		const city = await this.prisma.city.findFirst({ where: { id, isDeleted: false } });
		if (city === null) throw notFound("City", id);
		return toCityDto(city);
	}

	public async createCity(tx: GeoWriteTransaction, input: CreateCityInput): Promise<City> {
		await this.assertLiveState(tx, "stateId", input.stateId);
		await this.assertLiveCountry(tx, "countryId", input.countryId);
		return toCityDto(await tx.city.create({ data: toPrismaCreateCity(withSanitizedName(input)) }));
	}

	public async updateCity(tx: GeoWriteTransaction, id: number, input: UpdateCityInput): Promise<City> {
		if (input.stateId !== undefined) await this.assertLiveState(tx, "stateId", input.stateId);
		if (input.countryId !== undefined) await this.assertLiveCountry(tx, "countryId", input.countryId);
		const updated = await tx.city.updateMany({ where: { id, isDeleted: false }, data: toPrismaUpdateCity(withSanitizedName(input)) });
		if (updated.count === 0) throw notFound("City", id);
		return toCityDto(await tx.city.findUniqueOrThrow({ where: { id } }));
	}

	public async deleteCity(tx: GeoWriteTransaction, id: number, stamp: GeoDeletionStamp): Promise<MessageResponse> {
		const deleted = await tx.city.updateMany({ where: { id, isDeleted: false }, data: softDeleteData(stamp) });
		if (deleted.count === 0) throw notFound("City", id);
		return { message: `City #${String(id)} deleted` };
	}

	// ── Import ──────────────────────────────────────────────────────────

	/**
	 * Bulk import inside ONE `geo.reference_data.write` transaction:
	 *
	 * 1. a transaction-scoped advisory lock serializes concurrent imports, so
	 *    the `upsert` lookup below can never race another import into
	 *    duplicates;
	 * 2. every row is validated with the entity's zod contract and its parent
	 *    must be a live row — an invalid row is reported (`errors`, 1-based)
	 *    and skipped;
	 * 3. with `upsert`, a row matching a live row (or an earlier row of the same
	 *    import) by its natural key (name within its parent) is `updated`;
	 *    every other valid row is inserted in bulk.
	 *
	 * Unexpected database errors are NOT turned into row errors: they abort the
	 * whole import (nothing is half-written) and surface as a server error.
	 */
	public async importData(tx: GeoWriteTransaction, input: GeoImportInput): Promise<GeoImportResult> {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${GEO_IMPORT_LOCK_KEY}))`;

		const errors: { row: number; message: string }[] = [];
		const valid: { readonly rowNumber: number; readonly value: GeoImportRow }[] = [];
		input.data.forEach((raw: JsonObject, index: number): void => {
			const parsed = parseImportRow(input.entity, raw);
			if (parsed.ok) {
				valid.push({ rowNumber: index + 1, value: parsed.value });
			} else {
				errors.push({ row: index + 1, message: parsed.issues.map((issue): string => (issue.field === null ? issue.message : `${issue.field}: ${issue.message}`)).join("; ") });
			}
		});

		const missingParents: ReadonlyMap<number, string> = await this.findRowsWithMissingParents(tx, valid);
		const existingKeys: Map<string, number> = input.upsert ? await this.liveNaturalKeys(tx, valid) : new Map<string, number>();

		const toCreate: GeoImportRow[] = [];
		const toTouch: number[] = [];
		let updated = 0;
		const seenInImport = new Set<string>();
		for (const { rowNumber, value } of valid) {
			const parentError: string | undefined = missingParents.get(rowNumber);
			if (parentError !== undefined) {
				errors.push({ row: rowNumber, message: parentError });
				continue;
			}
			const key: string = naturalKey(value);
			const existingId: number | undefined = existingKeys.get(key);
			if (input.upsert && existingId !== undefined) {
				toTouch.push(existingId);
				updated += 1;
				continue;
			}
			if (input.upsert && seenInImport.has(key)) {
				updated += 1;
				continue;
			}
			seenInImport.add(key);
			toCreate.push(value);
		}

		await this.touchMatchedRows(tx, input.entity, toTouch);
		await this.insertRows(tx, toCreate);
		errors.sort((left, right): number => left.row - right.row);
		return { created: toCreate.length, updated, skipped: errors.length, errors };
	}

	public validateImport(input: GeoImportValidateInput): GeoImportValidationResult {
		const errors: { row: number; field: string | null; message: string }[] = [];
		let validRows = 0;
		input.data.forEach((raw: JsonObject, index: number): void => {
			const parsed = parseImportRow(input.entity, raw);
			if (parsed.ok) {
				validRows += 1;
				return;
			}
			errors.push(...parsed.issues.map((issue) => ({ row: index + 1, field: issue.field, message: issue.message })));
		});
		return { valid: errors.length === 0, totalRows: input.data.length, validRows, errors };
	}

	// ── Export ──────────────────────────────────────────────────────────

	public async exportData(query: GeoExportQuery): Promise<readonly City[]> {
		const { countryCode, regionId } = query;

		const countryWhere: Prisma.CountryWhereInput = {
			isDeleted: false,
			...(countryCode !== undefined ? { iso2: countryCode } : {}),
			...(regionId !== undefined ? { regionId } : {}),
		};
		const countries = await this.prisma.country.findMany({ where: countryWhere, orderBy: { name: "asc" } });
		if (countries.length === 0) return [];

		const countryIds = countries.map((c) => c.id);
		const states = await this.prisma.state.findMany({ where: { isDeleted: false, countryId: { in: countryIds } }, orderBy: { name: "asc" } });
		const stateIds = states.map((s) => s.id);
		const cities = await this.prisma.city.findMany({ where: { isDeleted: false, stateId: { in: stateIds } }, orderBy: { name: "asc" } });

		// The flat city rows ARE the export (see `GeoExportResponseSchema`).
		return cities.map(toCityDto);
	}

	// ── Cascade Preview ─────────────────────────────────────────────────

	/** What a delete would soft-delete — exactly the set the matching `delete*` method cascades to. */
	public async cascadePreview(input: CascadePreviewInput): Promise<CascadePreviewResult> {
		const { entity, id } = input;

		if (entity === "region") {
			const region = await this.prisma.region.findFirst({ where: { id, isDeleted: false } });
			if (region === null) throw notFound("Region", id);
			const [subregions, countries, states, cities] = await Promise.all([
				this.prisma.subregion.count({ where: { isDeleted: false, regionId: id } }),
				this.prisma.country.count({ where: { isDeleted: false, regionId: id } }),
				this.prisma.state.count({ where: { isDeleted: false, country: { regionId: id } } }),
				this.prisma.city.count({ where: { isDeleted: false, state: { country: { regionId: id } } } }),
			]);
			return { entity: "region", id, name: region.name, willDelete: { subregions, countries, states, cities } };
		}

		if (entity === "subregion") {
			const subregion = await this.prisma.subregion.findFirst({ where: { id, isDeleted: false } });
			if (subregion === null) throw notFound("Subregion", id);
			const [countries, states, cities] = await Promise.all([
				this.prisma.country.count({ where: { isDeleted: false, subregionId: id } }),
				this.prisma.state.count({ where: { isDeleted: false, country: { subregionId: id } } }),
				this.prisma.city.count({ where: { isDeleted: false, state: { country: { subregionId: id } } } }),
			]);
			return { entity: "subregion", id, name: subregion.name, willDelete: { countries, states, cities } };
		}

		if (entity === "country") {
			const country = await this.prisma.country.findFirst({ where: { id, isDeleted: false } });
			if (country === null) throw notFound("Country", id);
			const [states, cities] = await Promise.all([
				this.prisma.state.count({ where: { isDeleted: false, countryId: id } }),
				this.prisma.city.count({ where: { isDeleted: false, countryId: id } }),
			]);
			return { entity: "country", id, name: country.name, willDelete: { states, cities } };
		}

		const state = await this.prisma.state.findFirst({ where: { id, isDeleted: false } });
		if (state === null) throw notFound("State", id);
		const cities = await this.prisma.city.count({ where: { isDeleted: false, stateId: id } });
		return { entity: "state", id, name: state.name, willDelete: { cities } };
	}

	// ── Private helpers ─────────────────────────────────────────────────

	private async assertLiveRegion(tx: GeoWriteTransaction, field: string, id: number): Promise<void> {
		if ((await tx.region.count({ where: { id, isDeleted: false } })) === 0) throw missingParent(field, "region", id);
	}

	private async assertLiveSubregion(tx: GeoWriteTransaction, field: string, id: number): Promise<void> {
		if ((await tx.subregion.count({ where: { id, isDeleted: false } })) === 0) throw missingParent(field, "subregion", id);
	}

	private async assertLiveCountry(tx: GeoWriteTransaction, field: string, id: number): Promise<void> {
		if ((await tx.country.count({ where: { id, isDeleted: false } })) === 0) throw missingParent(field, "country", id);
	}

	private async assertLiveState(tx: GeoWriteTransaction, field: string, id: number): Promise<void> {
		if ((await tx.state.count({ where: { id, isDeleted: false } })) === 0) throw missingParent(field, "state", id);
	}

	/** A country's optional parents, when given (`null` detaches), must be live. */
	private async assertCountryParents(tx: GeoWriteTransaction, regionId: number | null | undefined, subregionId: number | null | undefined): Promise<void> {
		if (regionId !== undefined && regionId !== null) await this.assertLiveRegion(tx, "regionId", regionId);
		if (subregionId !== undefined && subregionId !== null) await this.assertLiveSubregion(tx, "subregionId", subregionId);
	}

	/** Row number → error for every valid row whose parent ids do not reference live rows (one query per parent table). */
	private async findRowsWithMissingParents(
		tx: GeoWriteTransaction,
		rows: readonly { readonly rowNumber: number; readonly value: GeoImportRow }[],
	): Promise<ReadonlyMap<number, string>> {
		const regionIds = new Set<number>();
		const countryIds = new Set<number>();
		const stateIds = new Set<number>();
		for (const { value } of rows) {
			if (value.entity === "subregion") regionIds.add(value.row.regionId);
			if (value.entity === "state") countryIds.add(value.row.countryId);
			if (value.entity === "city") {
				stateIds.add(value.row.stateId);
				countryIds.add(value.row.countryId);
			}
		}
		const liveIds = async (ids: ReadonlySet<number>, find: (ids: number[]) => Promise<{ readonly id: number }[]>): Promise<ReadonlySet<number>> =>
			ids.size === 0 ? new Set<number>() : new Set<number>((await find([...ids])).map((row): number => row.id));
		const [liveRegions, liveCountries, liveStates] = await Promise.all([
			liveIds(regionIds, (ids) => tx.region.findMany({ where: { id: { in: ids }, isDeleted: false }, select: { id: true } })),
			liveIds(countryIds, (ids) => tx.country.findMany({ where: { id: { in: ids }, isDeleted: false }, select: { id: true } })),
			liveIds(stateIds, (ids) => tx.state.findMany({ where: { id: { in: ids }, isDeleted: false }, select: { id: true } })),
		]);

		const missing = new Map<number, string>();
		for (const { rowNumber, value } of rows) {
			if (value.entity === "subregion" && !liveRegions.has(value.row.regionId))
				missing.set(rowNumber, `regionId ${String(value.row.regionId)} does not reference an existing region`);
			if (value.entity === "state" && !liveCountries.has(value.row.countryId))
				missing.set(rowNumber, `countryId ${String(value.row.countryId)} does not reference an existing country`);
			if (value.entity === "city" && !liveStates.has(value.row.stateId)) missing.set(rowNumber, `stateId ${String(value.row.stateId)} does not reference an existing state`);
			if (value.entity === "city" && !liveCountries.has(value.row.countryId))
				missing.set(rowNumber, `countryId ${String(value.row.countryId)} does not reference an existing country`);
		}
		return missing;
	}

	/** Natural key → id of the live rows an `upsert` import may match (one query). */
	private async liveNaturalKeys(tx: GeoWriteTransaction, rows: readonly { readonly value: GeoImportRow }[]): Promise<Map<string, number>> {
		const names: string[] = [...new Set(rows.map(({ value }): string => value.row.name))];
		if (names.length === 0) {
			return new Map<string, number>();
		}
		const [first] = rows;
		const entity: GeoImportEntity | undefined = first?.value.entity;
		const live = { isDeleted: false, name: { in: names } };
		switch (entity) {
			case undefined:
				return new Map<string, number>();
			case "region":
				return new Map((await tx.region.findMany({ where: live, select: { id: true, name: true } })).map((row): [string, number] => [row.name, row.id]));
			case "country":
				return new Map((await tx.country.findMany({ where: live, select: { id: true, name: true } })).map((row): [string, number] => [row.name, row.id]));
			case "subregion":
				return new Map(
					(await tx.subregion.findMany({ where: live, select: { id: true, name: true, regionId: true } })).map((row): [string, number] => [
						`${String(row.regionId)}:${row.name}`,
						row.id,
					]),
				);
			case "state":
				return new Map(
					(await tx.state.findMany({ where: live, select: { id: true, name: true, countryId: true } })).map((row): [string, number] => [
						`${String(row.countryId)}:${row.name}`,
						row.id,
					]),
				);
			case "city":
				return new Map(
					(await tx.city.findMany({ where: live, select: { id: true, name: true, stateId: true } })).map((row): [string, number] => [
						`${String(row.stateId)}:${row.name}`,
						row.id,
					]),
				);
			default:
				return assertNever(entity);
		}
	}

	/** Matched rows of an `upsert` import: stamp `updatedAt` (the import carries no other column to change). */
	private async touchMatchedRows(tx: GeoWriteTransaction, entity: GeoImportEntity, ids: readonly number[]): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		const where = { id: { in: [...ids] }, isDeleted: false };
		const data = { updatedAt: new Date() };
		switch (entity) {
			case "region":
				await tx.region.updateMany({ where, data });
				return;
			case "subregion":
				await tx.subregion.updateMany({ where, data });
				return;
			case "country":
				await tx.country.updateMany({ where, data });
				return;
			case "state":
				await tx.state.updateMany({ where, data });
				return;
			case "city":
				await tx.city.updateMany({ where, data });
				return;
			default:
				assertNever(entity);
		}
	}

	/** Bulk INSERT in bounded chunks (one statement per chunk). */
	private async insertRows(tx: GeoWriteTransaction, rows: readonly GeoImportRow[]): Promise<void> {
		for (let start = 0; start < rows.length; start += GEO_IMPORT_INSERT_CHUNK_SIZE) {
			const chunk: readonly GeoImportRow[] = rows.slice(start, start + GEO_IMPORT_INSERT_CHUNK_SIZE);
			await tx.region.createMany({ data: chunk.flatMap((r): Prisma.RegionCreateManyInput[] => (r.entity === "region" ? [{ name: r.row.name }] : [])) });
			await tx.subregion.createMany({
				data: chunk.flatMap((r): Prisma.SubregionCreateManyInput[] => (r.entity === "subregion" ? [{ name: r.row.name, regionId: r.row.regionId }] : [])),
			});
			await tx.country.createMany({ data: chunk.flatMap((r): Prisma.CountryCreateManyInput[] => (r.entity === "country" ? [{ name: r.row.name }] : [])) });
			await tx.state.createMany({
				data: chunk.flatMap((r): Prisma.StateCreateManyInput[] =>
					r.entity === "state" ? [{ name: r.row.name, countryId: r.row.countryId, countryCode: r.row.countryCode }] : [],
				),
			});
			await tx.city.createMany({
				data: chunk.flatMap((r): Prisma.CityCreateManyInput[] =>
					r.entity === "city"
						? [{ name: r.row.name, stateId: r.row.stateId, countryId: r.row.countryId, stateCode: r.row.stateCode, countryCode: r.row.countryCode, latitude: 0, longitude: 0 }]
						: [],
				),
			});
		}
	}

	private parseRegionInclude(include: string | undefined): Prisma.RegionInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.RegionInclude = {};
		if (parts.includes("subregions")) result.subregions = { where: { isDeleted: false } };
		if (parts.includes("countries")) result.countries = { where: { isDeleted: false } };
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseSubregionInclude(include: string | undefined): Prisma.SubregionInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.SubregionInclude = {};
		if (parts.includes("region")) result.region = true;
		if (parts.includes("countries")) result.countries = { where: { isDeleted: false } };
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseCountryInclude(include: string | undefined): Prisma.CountryInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.CountryInclude = {};
		if (parts.includes("region")) result.regionRelation = true;
		if (parts.includes("subregion")) result.subregionRelation = true;
		if (parts.includes("states")) result.states = { where: { isDeleted: false } };
		if (parts.includes("cities")) result.cities = { where: { isDeleted: false } };
		return Object.keys(result).length > 0 ? result : undefined;
	}

	private parseStateInclude(include: string | undefined): Prisma.StateInclude | undefined {
		if (!include) return undefined;
		const parts = include.split(",").map((s) => s.trim());
		const result: Prisma.StateInclude = {};
		if (parts.includes("country")) result.country = true;
		if (parts.includes("cities")) result.cities = { where: { isDeleted: false } };
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
}
