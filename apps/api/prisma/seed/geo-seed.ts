// ============================================
// seed/geo-seed.ts - Geographic data seeder
// ============================================
// Fetches regions, subregions, countries, states, and cities from the
// dr5hn/countries-states-cities-database GitHub repo and CONVERGES the geo
// tables to it: a row is matched on its natural key (name within its parent;
// countries by ISO2) and only missing rows are inserted. Nothing is ever
// deleted — geo reference data is soft-deleted only (DELETE is withheld from
// app_runtime, and other tables reference geo rows), so re-running the seed
// on an already-seeded database is a no-op, and rows a SuperAdmin
// soft-deleted (or created) through the API are left exactly as they are.
//
// Source: https://github.com/dr5hn/countries-states-cities-database
//   - regions.json                 → flat list
//   - subregions.json              → flat list with region_id
//   - countries.json               → flat list with region_id / subregion_id
//   - states.json                  → flat list with country_id
//   - countries+states+cities.json → nested: countries > states > cities
//
// Usage: pnpm db:seed  (called from the main seed orchestrator)

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { isArrayValue, isJsonPrimitive } from "@workspace/shared";

import { prisma } from "./client";
import { seedLog } from "./seed-log";

const API_BASE = "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/";

const GeoJsonValueSchema = z.json();
type GeoJsonValue = z.output<typeof GeoJsonValueSchema>;

const GeoRowSchema = z.record(z.string(), GeoJsonValueSchema);
type GeoRow = z.output<typeof GeoRowSchema>;

const GeoRowListSchema = z.array(GeoRowSchema);

async function fetchData(endpoint: string): Promise<readonly GeoRow[]> {
	const response = await fetch(`${API_BASE}${endpoint}.json`);
	const parsed = GeoRowListSchema.safeParse(await response.json());
	if (!parsed.success) {
		throw new Error(`Expected array from ${endpoint}`);
	}
	return parsed.data;
}

/** A JSON node that is neither a scalar nor a list is a row object. */
function isGeoRow(val: GeoJsonValue | undefined): val is GeoRow {
	return val !== undefined && !isJsonPrimitive(val) && !isArrayValue(val);
}

function rowList(val: GeoJsonValue | undefined): readonly GeoRow[] | undefined {
	if (!isArrayValue(val)) return undefined;
	return val.filter(isGeoRow);
}

/** JSON scalars the upstream dataset uses for text-ish fields (objects/arrays are never text). */
const GeoScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

function str(val: GeoJsonValue | undefined): string | null {
	const scalar = GeoScalarSchema.safeParse(val);
	return scalar.success ? String(scalar.data) : null;
}

function num(val: GeoJsonValue | undefined): number | null {
	if (val === null || val === undefined || val === "") return null;
	const n = Number(val);
	return Number.isFinite(n) ? n : null;
}

function bigInt(val: GeoJsonValue | undefined): bigint | null {
	if (val === null || val === undefined || val === "") return null;
	try {
		return BigInt(Math.trunc(Number(val)));
	} catch {
		return null;
	}
}

function toJson(val: GeoJsonValue | undefined): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
	if (val === null || val === undefined) {
		return Prisma.DbNull;
	}
	return val;
}

// ── Natural keys (what makes two rows "the same" reference row) ───────────

const regionKey = (name: string): string => name;
const childKey = (parentId: number, name: string): string => `${String(parentId)}:${name}`;
const countryKey = (iso2: string | null, name: string): string => (iso2 === null || iso2.length === 0 ? `name:${name}` : `iso2:${iso2}`);
/** Cities can share a name within a state; their coordinates tell them apart. */
const cityKey = (stateId: number, name: string, latitude: number, longitude: number): string => `${String(stateId)}:${name}:${String(latitude)}:${String(longitude)}`;

/** Rows per INSERT statement. */
const GEO_SEED_CHUNK_SIZE = 1_000;

/**
 * Insert the rows whose natural key is not present yet (chunked), and record
 * the new keys so duplicates inside the dataset are inserted once. Returns how
 * many rows were inserted.
 */
async function insertMissing<TRow>(
	rows: readonly TRow[],
	existingKeys: Set<string>,
	keyOf: (row: TRow) => string,
	insert: (chunk: TRow[]) => Promise<{ readonly count: number }>,
): Promise<number> {
	const missing: TRow[] = [];
	for (const row of rows) {
		const key: string = keyOf(row);
		if (!existingKeys.has(key)) {
			existingKeys.add(key);
			missing.push(row);
		}
	}
	let inserted = 0;
	for (let start = 0; start < missing.length; start += GEO_SEED_CHUNK_SIZE) {
		inserted += (await insert(missing.slice(start, start + GEO_SEED_CHUNK_SIZE))).count;
	}
	return inserted;
}

/** Upstream numeric id → our id, resolved through the natural key. */
function mapUpstreamIds(rows: readonly GeoRow[], keyOf: (row: GeoRow) => string | null, idByKey: ReadonlyMap<string, number>): Map<number, number> {
	const mapped = new Map<number, number>();
	for (const row of rows) {
		const upstreamId: number | null = num(row.id);
		const key: string | null = keyOf(row);
		const id: number | undefined = key === null ? undefined : idByKey.get(key);
		if (upstreamId !== null && id !== undefined) {
			mapped.set(upstreamId, id);
		}
	}
	return mapped;
}

// ── Main seed ──────────────────────────────────────────────────────────────

export async function seedGeo(): Promise<void> {
	seedLog("Geo seeding started (converging to the upstream dataset; no deletes)...");

	// ── Regions ────────────────────────────────────────────────────────
	const regionRows = await fetchData("regions");
	const regionInputs: Prisma.RegionCreateManyInput[] = regionRows.flatMap((row): Prisma.RegionCreateManyInput[] => {
		const name: string | null = str(row.name);
		return name === null ? [] : [{ name, translations: toJson(row.translations), wikiDataId: str(row.wikiDataId) }];
	});
	const existingRegions = await prisma.region.findMany({ select: { id: true, name: true } });
	const regionsInserted: number = await insertMissing(
		regionInputs,
		new Set(existingRegions.map((r) => regionKey(r.name))),
		(r) => regionKey(r.name),
		async (chunk) => prisma.region.createMany({ data: chunk }),
	);
	const regionIdByKey = new Map((await prisma.region.findMany({ select: { id: true, name: true } })).map((r): [string, number] => [regionKey(r.name), r.id]));
	const apiRegionById = mapUpstreamIds(regionRows, (row) => str(row.name), regionIdByKey);
	seedLog(`Regions: ${String(regionIdByKey.size)} (${String(regionsInserted)} inserted)`);

	// ── Subregions ─────────────────────────────────────────────────────
	const subregionRows = await fetchData("subregions");
	const subregionInputs: Prisma.SubregionCreateManyInput[] = subregionRows.flatMap((row): Prisma.SubregionCreateManyInput[] => {
		const upstreamRegionId: number | null = num(row.region_id);
		const regionId: number | undefined = upstreamRegionId === null ? undefined : apiRegionById.get(upstreamRegionId);
		const name: string | null = str(row.name);
		return regionId === undefined || name === null ? [] : [{ name, regionId, translations: toJson(row.translations), wikiDataId: str(row.wikiDataId) }];
	});
	const existingSubregions = await prisma.subregion.findMany({ select: { id: true, name: true, regionId: true } });
	const subregionsInserted: number = await insertMissing(
		subregionInputs,
		new Set(existingSubregions.map((r) => childKey(r.regionId, r.name))),
		(r) => childKey(r.regionId, r.name),
		async (chunk) => prisma.subregion.createMany({ data: chunk }),
	);
	const subregionIdByKey = new Map(
		(await prisma.subregion.findMany({ select: { id: true, name: true, regionId: true } })).map((r): [string, number] => [childKey(r.regionId, r.name), r.id]),
	);
	const apiSubregionById = mapUpstreamIds(
		subregionRows,
		(row) => {
			const upstreamRegionId: number | null = num(row.region_id);
			const regionId: number | undefined = upstreamRegionId === null ? undefined : apiRegionById.get(upstreamRegionId);
			const name: string | null = str(row.name);
			return regionId === undefined || name === null ? null : childKey(regionId, name);
		},
		subregionIdByKey,
	);
	seedLog(`Subregions: ${String(subregionIdByKey.size)} (${String(subregionsInserted)} inserted)`);

	// ── Countries ──────────────────────────────────────────────────────
	const countryRows = await fetchData("countries");
	const countryInputs: Prisma.CountryCreateManyInput[] = countryRows.flatMap((row): Prisma.CountryCreateManyInput[] => {
		const name: string | null = str(row.name);
		if (name === null) return [];
		const upstreamRegionId: number | null = num(row.region_id);
		const upstreamSubregionId: number | null = num(row.subregion_id);
		return [
			{
				name,
				iso3: str(row.iso3),
				iso2: str(row.iso2),
				numericCode: str(row.numeric_code),
				phonecode: str(row.phonecode),
				capital: str(row.capital),
				currency: str(row.currency),
				currencyName: str(row.currency_name),
				currencySymbol: str(row.currency_symbol),
				tld: str(row.tld),
				native: str(row.native),
				nationality: str(row.nationality),
				region: str(row.region),
				subregion: str(row.subregion),
				population: bigInt(row.population),
				gdp: bigInt(row.gdp),
				latitude: num(row.latitude),
				longitude: num(row.longitude),
				emoji: str(row.emoji),
				emojiU: str(row.emojiU),
				timezones: toJson(row.timezones),
				translations: toJson(row.translations),
				wikiDataId: str(row.wikiDataId),
				regionId: upstreamRegionId === null ? null : (apiRegionById.get(upstreamRegionId) ?? null),
				subregionId: upstreamSubregionId === null ? null : (apiSubregionById.get(upstreamSubregionId) ?? null),
			},
		];
	});
	const existingCountries = await prisma.country.findMany({ select: { id: true, name: true, iso2: true } });
	const countriesInserted: number = await insertMissing(
		countryInputs,
		new Set(existingCountries.map((c) => countryKey(c.iso2, c.name))),
		(c) => countryKey(c.iso2 ?? null, c.name),
		async (chunk) => prisma.country.createMany({ data: chunk }),
	);
	const allCountries = await prisma.country.findMany({ select: { id: true, iso2: true } });
	const countryIdByIso2 = new Map(allCountries.flatMap((c): [string, number][] => (c.iso2 === null ? [] : [[c.iso2, c.id]])));
	seedLog(`Countries: ${String(allCountries.length)} (${String(countriesInserted)} inserted)`);

	// ── States ─────────────────────────────────────────────────────────
	const stateRows = await fetchData("states");
	const stateInputs: Prisma.StateCreateManyInput[] = stateRows.flatMap((row): Prisma.StateCreateManyInput[] => {
		const countryCode: string = str(row.country_code) ?? "";
		const countryId: number | undefined = countryIdByIso2.get(countryCode);
		const name: string | null = str(row.name);
		if (countryId === undefined || name === null) return [];
		return [
			{
				name,
				countryCode,
				fipsCode: str(row.fips_code),
				iso2: str(row.iso2),
				iso3166_2: str(row.iso3166_2),
				type: str(row.type),
				level: num(row.level),
				parentId: num(row.parent_id),
				native: str(row.native),
				latitude: num(row.latitude),
				longitude: num(row.longitude),
				timezone: str(row.timezone),
				translations: toJson(row.translations),
				wikiDataId: str(row.wikiDataId),
				countryId,
			},
		];
	});
	const existingStates = await prisma.state.findMany({ select: { id: true, name: true, countryId: true } });
	const statesInserted: number = await insertMissing(
		stateInputs,
		new Set(existingStates.map((s) => childKey(s.countryId, s.name))),
		(s) => childKey(s.countryId, s.name),
		async (chunk) => prisma.state.createMany({ data: chunk }),
	);
	const stateIdByKey = new Map(
		(await prisma.state.findMany({ select: { id: true, name: true, countryId: true } })).map((s): [string, number] => [childKey(s.countryId, s.name), s.id]),
	);
	seedLog(`States: ${String(stateIdByKey.size)} (${String(statesInserted)} inserted)`);

	// ── Cities (from countries+states+cities.json — nested) ────────────
	const nestedRows = await fetchData("countries%2Bstates%2Bcities");
	const cityInputs: Prisma.CityCreateManyInput[] = nestedRows.flatMap((country): Prisma.CityCreateManyInput[] => {
		const countryIso2: string = str(country.iso2) ?? "";
		const countryId: number | undefined = countryIdByIso2.get(countryIso2);
		if (countryId === undefined) return [];
		return (rowList(country.states) ?? []).flatMap((state): Prisma.CityCreateManyInput[] => {
			const stateId: number | undefined = stateIdByKey.get(childKey(countryId, str(state.name) ?? ""));
			if (stateId === undefined) return [];
			return (rowList(state.cities) ?? []).flatMap((city): Prisma.CityCreateManyInput[] => {
				const name: string | null = str(city.name);
				return name === null
					? []
					: [
							{
								name,
								stateCode: str(state.iso2) ?? "",
								countryCode: countryIso2,
								latitude: num(city.latitude) ?? 0,
								longitude: num(city.longitude) ?? 0,
								native: str(city.native),
								timezone: str(city.timezone),
								wikiDataId: str(city.wikiDataId),
								stateId,
								countryId,
							},
						];
			});
		});
	});
	const existingCities = await prisma.city.findMany({ select: { name: true, stateId: true, latitude: true, longitude: true } });
	const citiesInserted: number = await insertMissing(
		cityInputs,
		new Set(existingCities.map((c) => cityKey(c.stateId, c.name, c.latitude.toNumber(), c.longitude.toNumber()))),
		(c) => cityKey(c.stateId, c.name, Number(c.latitude), Number(c.longitude)),
		async (chunk) => prisma.city.createMany({ data: chunk }),
	);
	seedLog(`Cities: ${String(existingCities.length + citiesInserted)} (${String(citiesInserted)} inserted)`);

	seedLog("Geo seeding completed!");
}
