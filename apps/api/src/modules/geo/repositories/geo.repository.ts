import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";

import type {
	CityListQuery,
	CountryListQuery,
	GeoAutocompleteQuery,
	GeoExportQuery,
	GeoImportInput,
	GeoImportValidateInput,
	CascadePreviewInput,
	PaginationInput,
	RegionListQuery,
	StateListQuery,
	SubregionListQuery,
} from "@workspace/shared";
import { buildOffsetPaginationMeta } from "@workspace/shared";
import type { City, Country, Prisma, Region, State, Subregion } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Recursively convert non-JSON-safe Prisma types (BigInt, Decimal, Date)
 * to JSON-safe primitives so the data can pass DataValueSchema validation
 * in the ResponseInterceptor.
 */
function sanitizeForDataValue<T>(obj: T): T {
	function toDataValue(v: unknown): unknown {
		if (v === null || v === undefined) return v;
		if (typeof v === "bigint") return Number(v);
		if (v instanceof Date) return v.toISOString();
		if (Array.isArray(v)) return v.map(toDataValue);
		if (typeof v === "object") {
			// Prisma Decimal: detect via toNumber method (duck-typing)
			if ("toNumber" in v && typeof v.toNumber === "function") {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call -- Prisma Decimal.toNumber() returns number
				return Number(v.toNumber());
			}
			const out: Record<string, unknown> = {};
			for (const [k, val] of Object.entries(v)) {
				out[k] = toDataValue(val);
			}
			return out;
		}
		return v;
	}
	// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe by construction: toDataValue preserves object shape
	return toDataValue(obj) as T;
}

/** Hybrid list response shape (matches {@link PaginatedServiceResult} for the response interceptor). */
export interface ListResult<T> {
	readonly items: readonly T[];
	readonly limit: number;
	readonly total: number;
	readonly page: number;
	readonly totalPages: number;
	readonly nextCursor: string | null;
	readonly hasNext: boolean;
	readonly hasPrevious: boolean;
}

/** Encode an id into an opaque cursor string. */
function encodeCursor(id: number): string {
	return Buffer.from(String(id), "utf-8").toString("base64url");
}

/** Decode an opaque cursor string back to an id. Returns null if invalid. */
function decodeCursor(cursor: string): number | null {
	try {
		const decoded = Number(Buffer.from(cursor, "base64url").toString("utf-8"));
		return Number.isFinite(decoded) && decoded >= 0 ? decoded : null;
	} catch {
		return null;
	}
}

type GeoCursorOrder = { readonly id: "asc" };

async function fetchGeoCursorPage<TWhere, TRow extends { id: number }>(options: {
	readonly limit: number;
	readonly cursor?: string;
	readonly where: TWhere;
	readonly findMany: (args: { where: TWhere; take: number; skip?: number; orderBy: GeoCursorOrder }) => Promise<TRow[]>;
}): Promise<{ readonly items: readonly TRow[]; readonly nextCursor: string | null; readonly hasNext: boolean }> {
	const cursorId = options.cursor !== undefined ? decodeCursor(options.cursor) : null;
	const mergedWhere: TWhere =
		cursorId !== null ? ({ ...options.where, id: { gt: cursorId } } as TWhere) : options.where;
	const rows = await options.findMany({ where: mergedWhere, take: options.limit + 1, orderBy: { id: "asc" } });
	const hasNext = rows.length > options.limit;
	const items = hasNext ? rows.slice(0, options.limit) : rows;
	const lastItem = items[items.length - 1];
	const nextCursor = hasNext && lastItem !== undefined ? encodeCursor(lastItem.id) : null;
	return { items: sanitizeForDataValue(items), nextCursor, hasNext };
}

interface FetchGeoListPageOptions<TWhere, TRow extends { id: number }> {
	readonly where: TWhere;
	readonly count: (where: TWhere) => Promise<number>;
	readonly findMany: (args: { where: TWhere; take: number; skip?: number; orderBy: GeoCursorOrder }) => Promise<TRow[]>;
}

/** Offset + cursor list pagination for geo entities keyed by ascending numeric `id`. */
async function fetchGeoListPage<TWhere, TRow extends { id: number }>(
	query: PaginationInput,
	options: FetchGeoListPageOptions<TWhere, TRow>,
): Promise<ListResult<TRow>> {
	const total = await options.count(options.where);
	const useCursor = query.cursor !== undefined;
	const page = query.page ?? 1;
	const offsetMeta = buildOffsetPaginationMeta(total, page, query.limit);

	if (useCursor) {
		const cursorResult = await fetchGeoCursorPage({
			limit: query.limit,
			cursor: query.cursor,
			where: options.where,
			findMany: options.findMany,
		});
		return {
			items: cursorResult.items,
			limit: query.limit,
			total,
			page: offsetMeta.page,
			totalPages: offsetMeta.totalPages,
			nextCursor: cursorResult.nextCursor,
			hasNext: cursorResult.hasNext,
			hasPrevious: false,
		};
	}

	const skip = (offsetMeta.page - 1) * query.limit;
	const rows = await options.findMany({
		where: options.where,
		skip,
		take: query.limit,
		orderBy: { id: "asc" },
	});
	const lastRow = rows[rows.length - 1];
	const nextCursor = offsetMeta.hasNext && lastRow !== undefined ? encodeCursor(lastRow.id) : null;
	return {
		items: sanitizeForDataValue(rows),
		limit: query.limit,
		total,
		page: offsetMeta.page,
		totalPages: offsetMeta.totalPages,
		nextCursor,
		hasNext: offsetMeta.hasNext,
		hasPrevious: offsetMeta.hasPrevious,
	};
}

/** Geo entity counts. */
export interface GeoStats {
	readonly regions: number;
	readonly subregions: number;
	readonly countries: number;
	readonly states: number;
	readonly cities: number;
}

/** Autocomplete result item. */
export interface AutocompleteItem {
	readonly id: number;
	readonly name: string;
	readonly entityType: "region" | "subregion" | "country" | "state" | "city";
	readonly countryCode: string | null;
	readonly stateCode: string | null;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly emoji: string | null;
}

/** Cascade preview result. */
export interface CascadePreviewResult {
	readonly entity: string;
	readonly id: number;
	readonly name: string;
	readonly willDelete: {
		readonly subregions?: number;
		readonly countries?: number;
		readonly states?: number;
		readonly cities?: number;
	};
}

/** Import result. */
export interface ImportResult {
	readonly created: number;
	readonly updated: number;
	readonly skipped: number;
	readonly errors: readonly { readonly row: number; readonly message: string }[];
}

/** Import validation result. */
export interface ImportValidationResult {
	readonly valid: boolean;
	readonly totalRows: number;
	readonly validRows: number;
	readonly errors: readonly { readonly row: number; readonly field: string | null; readonly message: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parse a sort string like "-name" into { field: "name", direction: "desc" }. */
function parseSort(sort: string | undefined, allowedFields: readonly string[]): { readonly field: string; readonly dir: Prisma.SortOrder } {
	if (!sort) return { field: "name", dir: "asc" };
	const desc = sort.startsWith("-");
	const field = desc ? sort.slice(1) : sort;
	const dir: Prisma.SortOrder = desc ? "desc" : "asc";
	return { field: allowedFields.includes(field) ? field : "name", dir };
}

/** Parse comma-separated IDs into a number array. */
function parseIds(ids: string | undefined): number[] | null {
	if (!ids) return null;
	return ids
		.split(",")
		.map((s) => Number(s.trim()))
		.filter((n) => Number.isFinite(n) && n >= 0);
}

/** Sanitize a string value — strip HTML tags and trim. */
function sanitize(val: string | null | undefined): string | null {
	if (val === null || val === undefined) return null;
	return val.replace(/<[^>]*>/g, "").trim();
}

const geoNameFieldSchema = z.string();
const geoNonEmptyNameSchema = z.string().trim().min(1);
const geoNonNegativeIntSchema = z.number().int().nonnegative();

function sanitizePrismaNameField(input: { name?: unknown }): void {
	const parsed = geoNameFieldSchema.safeParse(input.name);
	if (parsed.success) {
		input.name = sanitize(parsed.data) ?? parsed.data;
	}
}

function parseImportName(row: Record<string, unknown>): string | null {
	const parsed = geoNameFieldSchema.safeParse(row.name);
	if (!parsed.success) {
		return null;
	}
	return sanitize(parsed.data);
}

function parseImportIntField(row: Record<string, unknown>, field: string): number | null {
	const parsed = geoNonNegativeIntSchema.safeParse(row[field]);
	return parsed.success ? parsed.data : null;
}

function parseImportStringField(row: Record<string, unknown>, field: string, fallback = ""): string {
	const parsed = geoNameFieldSchema.safeParse(row[field]);
	return parsed.success ? parsed.data : fallback;
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

	public async autocomplete(query: GeoAutocompleteQuery): Promise<readonly AutocompleteItem[]> {
		const { q, country, limit } = query;
		const like = `%${q}%`;
		const countryFilter = country ? { countryCode: country } : {};

		const [regions, subregions, countries, states, cities]: [Region[], Subregion[], Country[], State[], City[]] = await Promise.all([
			this.prisma.region.findMany({ where: { name: { contains: like, mode: "insensitive" } }, take: limit }),
			this.prisma.subregion.findMany({ where: { name: { contains: like, mode: "insensitive" } }, take: limit }),
			this.prisma.country.findMany({ where: { name: { contains: like, mode: "insensitive" } }, take: limit }),
			this.prisma.state.findMany({ where: { name: { contains: like, mode: "insensitive" }, ...countryFilter }, take: limit }),
			this.prisma.city.findMany({ where: { name: { contains: like, mode: "insensitive" }, ...countryFilter }, take: limit }),
		]);

		const items: AutocompleteItem[] = [];
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
				latitude: c.latitude != null ? Number(c.latitude) : null,
				longitude: c.longitude != null ? Number(c.longitude) : null,
				emoji: c.emoji,
			});
		for (const s of states)
			items.push({
				id: s.id,
				name: s.name,
				entityType: "state",
				countryCode: s.countryCode,
				stateCode: s.iso2,
				latitude: s.latitude != null ? Number(s.latitude) : null,
				longitude: s.longitude != null ? Number(s.longitude) : null,
				emoji: null,
			});
		for (const c of cities)
			items.push({
				id: c.id,
				name: c.name,
				entityType: "city",
				countryCode: c.countryCode,
				stateCode: c.stateCode,
				latitude: Number(c.latitude),
				longitude: Number(c.longitude),
				emoji: null,
			});

		return items.slice(0, limit);
	}

	// ── Region ──────────────────────────────────────────────────────────

	public async listRegions(query: RegionListQuery): Promise<ListResult<Region>> {
		const { search, flag, ids, include } = query;
		const idList = parseIds(ids);
		const searchIds = search !== undefined ? await this.fuzzySearchIds("regions", search, 200) : null;
		const where: Prisma.RegionWhereInput = {
			...(searchIds !== null ? { id: { in: searchIds } } : {}),
			...(flag !== undefined ? { flag } : {}),
			...(idList !== null ? { id: { in: idList } } : {}),
		};
		const includeObj = this.parseRegionInclude(include);
		return fetchGeoListPage(query, {
			where,
			count: (listWhere) => this.prisma.region.count({ where: listWhere }),
			findMany: (args) => this.prisma.region.findMany({ ...args, include: includeObj }),
		});
	}

	public async getRegion(id: number): Promise<Region> {
		const region = await this.prisma.region.findUnique({ where: { id } });
		if (region === null) throw new NotFoundException(`Region #${String(id)} not found`);
		return region;
	}

	public async createRegion(input: Prisma.RegionCreateInput): Promise<Region> {
		if (input.name) sanitizePrismaNameField(input);
		return this.prisma.region.create({ data: input });
	}

	public async updateRegion(id: number, input: Prisma.RegionUpdateInput): Promise<Region> {
		await this.getRegion(id);
		sanitizePrismaNameField(input);
		return this.prisma.region.update({ where: { id }, data: input });
	}

	public async deleteRegion(id: number): Promise<{ readonly message: string }> {
		await this.getRegion(id);
		await this.prisma.region.delete({ where: { id } });
		return { message: `Region #${String(id)} deleted` };
	}

	// ── Subregion ───────────────────────────────────────────────────────

	public async listSubregions(query: SubregionListQuery): Promise<ListResult<Subregion>> {
		const { search, regionId, flag, ids, include } = query;
		const idList = parseIds(ids);
		const searchIds = search !== undefined ? await this.fuzzySearchIds("subregions", search, 200) : null;
		const where: Prisma.SubregionWhereInput = {
			...(searchIds !== null ? { id: { in: searchIds } } : {}),
			...(regionId !== undefined ? { regionId } : {}),
			...(flag !== undefined ? { flag } : {}),
			...(idList !== null ? { id: { in: idList } } : {}),
		};
		const includeObj = this.parseSubregionInclude(include);
		return fetchGeoListPage(query, {
			where,
			count: (listWhere) => this.prisma.subregion.count({ where: listWhere }),
			findMany: (args) => this.prisma.subregion.findMany({ ...args, include: includeObj }),
		});
	}

	public async getSubregion(id: number): Promise<Subregion> {
		const subregion = await this.prisma.subregion.findUnique({ where: { id } });
		if (subregion === null) throw new NotFoundException(`Subregion #${String(id)} not found`);
		return subregion;
	}

	public async createSubregion(input: Prisma.SubregionCreateInput): Promise<Subregion> {
		if (input.name) sanitizePrismaNameField(input);
		return this.prisma.subregion.create({ data: input });
	}

	public async updateSubregion(id: number, input: Prisma.SubregionUpdateInput): Promise<Subregion> {
		await this.getSubregion(id);
		sanitizePrismaNameField(input);
		return this.prisma.subregion.update({ where: { id }, data: input });
	}

	public async deleteSubregion(id: number): Promise<{ readonly message: string }> {
		await this.getSubregion(id);
		await this.prisma.subregion.delete({ where: { id } });
		return { message: `Subregion #${String(id)} deleted` };
	}

	// ── Country ─────────────────────────────────────────────────────────

	public async listCountries(query: CountryListQuery): Promise<ListResult<Country>> {
		const { search, iso2, regionId, subregionId, flag, ids, include } = query;
		const idList = parseIds(ids);
		const searchIds = search !== undefined ? await this.fuzzySearchIds("countries", search, 200) : null;
		const where: Prisma.CountryWhereInput = {
			...(searchIds !== null ? { id: { in: searchIds } } : {}),
			...(iso2 !== undefined ? { iso2 } : {}),
			...(regionId !== undefined ? { regionId } : {}),
			...(subregionId !== undefined ? { subregionId } : {}),
			...(flag !== undefined ? { flag } : {}),
			...(idList !== null ? { id: { in: idList } } : {}),
		};
		const includeObj = this.parseCountryInclude(include);
		return fetchGeoListPage(query, {
			where,
			count: (listWhere) => this.prisma.country.count({ where: listWhere }),
			findMany: (args) => this.prisma.country.findMany({ ...args, include: includeObj }),
		});
	}

	public async getCountry(id: number): Promise<Country> {
		const country = await this.prisma.country.findUnique({ where: { id } });
		if (country === null) throw new NotFoundException(`Country #${String(id)} not found`);
		return country;
	}

	public async createCountry(input: Prisma.CountryCreateInput): Promise<Country> {
		if (input.name) sanitizePrismaNameField(input);
		return this.prisma.country.create({ data: input });
	}

	public async updateCountry(id: number, input: Prisma.CountryUpdateInput): Promise<Country> {
		await this.getCountry(id);
		sanitizePrismaNameField(input);
		return this.prisma.country.update({ where: { id }, data: input });
	}

	public async deleteCountry(id: number): Promise<{ readonly message: string }> {
		await this.getCountry(id);
		await this.prisma.country.delete({ where: { id } });
		return { message: `Country #${String(id)} deleted` };
	}

	// ── State ───────────────────────────────────────────────────────────

	public async listStates(query: StateListQuery): Promise<ListResult<State>> {
		const { search, countryId, countryCode, flag, ids, include } = query;
		const idList = parseIds(ids);
		const searchIds = search !== undefined ? await this.fuzzySearchIds("states", search, 200) : null;
		const where: Prisma.StateWhereInput = {
			...(searchIds !== null ? { id: { in: searchIds } } : {}),
			...(countryId !== undefined ? { countryId } : {}),
			...(countryCode !== undefined ? { countryCode } : {}),
			...(flag !== undefined ? { flag } : {}),
			...(idList !== null ? { id: { in: idList } } : {}),
		};
		const includeObj = this.parseStateInclude(include);
		return fetchGeoListPage(query, {
			where,
			count: (listWhere) => this.prisma.state.count({ where: listWhere }),
			findMany: (args) => this.prisma.state.findMany({ ...args, include: includeObj }),
		});
	}

	public async getState(id: number): Promise<State> {
		const state = await this.prisma.state.findUnique({ where: { id } });
		if (state === null) throw new NotFoundException(`State #${String(id)} not found`);
		return state;
	}

	public async createState(input: Prisma.StateCreateInput): Promise<State> {
		if (input.name) sanitizePrismaNameField(input);
		return this.prisma.state.create({ data: input });
	}

	public async updateState(id: number, input: Prisma.StateUpdateInput): Promise<State> {
		await this.getState(id);
		sanitizePrismaNameField(input);
		return this.prisma.state.update({ where: { id }, data: input });
	}

	public async deleteState(id: number): Promise<{ readonly message: string }> {
		await this.getState(id);
		await this.prisma.state.delete({ where: { id } });
		return { message: `State #${String(id)} deleted` };
	}

	// ── City ────────────────────────────────────────────────────────────

	public async listCities(query: CityListQuery): Promise<ListResult<City>> {
		const { search, stateId, countryId, countryCode, stateCode, flag, ids, include } = query;
		const idList = parseIds(ids);
		const searchIds = search !== undefined ? await this.fuzzySearchIds("cities", search, 200) : null;
		const where: Prisma.CityWhereInput = {
			...(searchIds !== null ? { id: { in: searchIds } } : {}),
			...(stateId !== undefined ? { stateId } : {}),
			...(countryId !== undefined ? { countryId } : {}),
			...(countryCode !== undefined ? { countryCode } : {}),
			...(stateCode !== undefined ? { stateCode } : {}),
			...(flag !== undefined ? { flag } : {}),
			...(idList !== null ? { id: { in: idList } } : {}),
		};
		const includeObj = this.parseCityInclude(include);
		return fetchGeoListPage(query, {
			where,
			count: (listWhere) => this.prisma.city.count({ where: listWhere }),
			findMany: (args) => this.prisma.city.findMany({ ...args, include: includeObj }),
		});
	}

	public async getCity(id: number): Promise<City> {
		const city = await this.prisma.city.findUnique({ where: { id } });
		if (city === null) throw new NotFoundException(`City #${String(id)} not found`);
		return city;
	}

	public async createCity(input: Prisma.CityCreateInput): Promise<City> {
		if (input.name) sanitizePrismaNameField(input);
		return this.prisma.city.create({ data: input });
	}

	public async updateCity(id: number, input: Prisma.CityUpdateInput): Promise<City> {
		await this.getCity(id);
		sanitizePrismaNameField(input);
		return this.prisma.city.update({ where: { id }, data: input });
	}

	public async deleteCity(id: number): Promise<{ readonly message: string }> {
		await this.getCity(id);
		await this.prisma.city.delete({ where: { id } });
		return { message: `City #${String(id)} deleted` };
	}

	// ── Import ──────────────────────────────────────────────────────────

	public async importData(input: GeoImportInput): Promise<ImportResult> {
		const { entity, data, upsert } = input;
		let created = 0;
		let updated = 0;
		let skipped = 0;
		const errors: { row: number; message: string }[] = [];

		for (let i = 0; i < data.length; i++) {
			const row = data[i];
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

	public validateImport(input: GeoImportValidateInput): ImportValidationResult {
		const { entity, data } = input;
		const errors: { row: number; field: string | null; message: string }[] = [];
		let validRows = 0;

		for (let i = 0; i < data.length; i++) {
			const row = data[i];
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

	public async exportData(query: GeoExportQuery): Promise<readonly Region[] | readonly Subregion[] | readonly Country[] | readonly State[] | readonly City[]> {
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

		// Return as a flat array for CSV export
		return cities;
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

	private async importRow(entity: string, row: Record<string, unknown>, upsert: boolean): Promise<"created" | "updated" | "skipped"> {
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

	private validateRow(entity: string, row: Record<string, unknown>): readonly { readonly field: string | null; readonly message: string }[] {
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
