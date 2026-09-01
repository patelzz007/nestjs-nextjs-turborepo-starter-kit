// ============================================
// seed/geo-seed.ts - Geographic data seeder
// ============================================
// Fetches regions, subregions, countries, states, and cities from the
// dr5hn/countries-states-cities-database GitHub repo and inserts them
// into PostgreSQL via Prisma.
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

import { prisma } from "./client";

const API_BASE = "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/";

async function fetchData(endpoint: string): Promise<readonly Record<string, unknown>[]> {
	const response = await fetch(`${API_BASE}${endpoint}.json`);
	const json: unknown = await response.json();
	if (!Array.isArray(json)) {
		throw new Error(`Expected array from ${endpoint}`);
	}
	return json as readonly Record<string, unknown>[];
}

function str(val: unknown): string | null {
	if (val === null || val === undefined) return null;
	return String(val);
}

function num(val: unknown): number | null {
	if (val === null || val === undefined || val === "") return null;
	const n = Number(val);
	return Number.isFinite(n) ? n : null;
}

function bigInt(val: unknown): bigint | null {
	if (val === null || val === undefined || val === "") return null;
	try {
		return BigInt(Math.trunc(Number(val)));
	} catch {
		return null;
	}
}

function toJson(val: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
	if (val === null || val === undefined) {
		return Prisma.DbNull;
	}
	return JSON.parse(JSON.stringify(val)) as Prisma.InputJsonValue;
}

// ── Main seed ──────────────────────────────────────────────────────────────

export async function seedGeo(): Promise<void> {
	console.log("Geo seeding started...");

	// ── Cleanup (geo tables are not cleaned in the main seed's volatile wipe)
	await prisma.city.deleteMany();
	await prisma.state.deleteMany();
	await prisma.country.deleteMany();
	await prisma.subregion.deleteMany();
	await prisma.region.deleteMany();

	// ── Regions ────────────────────────────────────────────────────────
	const regionRows = await fetchData("regions");
	await prisma.region.createMany({
		data: regionRows.map((row) => ({
			name: String(row.name ?? ""),
			translations: toJson(row.translations),
			wikiDataId: str(row.wikiDataId),
		})),
		skipDuplicates: true,
	});

	// DB id → name
	const allRegions = await prisma.region.findMany();
	const dbRegionByName = new Map(allRegions.map((r) => [r.name, r.id]));

	// API region_id → DB id (regions.json has numeric `id`, subregions/countries reference it)
	const apiRegionById = new Map<number, number>();
	for (const row of regionRows) {
		const apiId = num(row.id);
		const name = str(row.name);
		if (apiId !== null && name !== null) {
			const dbId = dbRegionByName.get(name);
			if (dbId !== undefined) apiRegionById.set(apiId, dbId);
		}
	}
	console.log(`Seeded ${String(allRegions.length)} regions`);

	// ── Subregions ─────────────────────────────────────────────────────
	const subregionRows = await fetchData("subregions");

	// API subregion_id → DB id (subregions.json has numeric `id`, countries reference it)
	const apiSubregionById = new Map<number, number>();
	for (const row of subregionRows) {
		const apiId = num(row.id);
		const name = str(row.name);
		if (apiId !== null && name !== null) {
			// Will be resolved after insert
			apiSubregionById.set(apiId, -1); // placeholder
		}
	}

	await prisma.subregion.createMany({
		data: subregionRows
			.map((row) => {
				const apiRegionId = num(row.region_id);
				const regionId = apiRegionId !== null ? apiRegionById.get(apiRegionId) : undefined;
				if (!regionId) return null;
				return {
					name: String(row.name ?? ""),
					translations: toJson(row.translations),
					wikiDataId: str(row.wikiDataId),
					regionId,
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null),
		skipDuplicates: true,
	});

	// Resolve API subregion_id → DB id after insert
	const allSubregions = await prisma.subregion.findMany();
	const dbSubregionByName = new Map(allSubregions.map((sr) => [sr.name, sr.id]));
	for (const row of subregionRows) {
		const apiId = num(row.id);
		const name = str(row.name);
		if (apiId !== null && name !== null) {
			const dbId = dbSubregionByName.get(name);
			if (dbId !== undefined) apiSubregionById.set(apiId, dbId);
		}
	}
	console.log(`Seeded ${String(allSubregions.length)} subregions`);

	// ── Countries ──────────────────────────────────────────────────────
	const countryRows = await fetchData("countries");
	await prisma.country.createMany({
		data: countryRows.map((row) => {
			const apiRegionId = num(row.region_id);
			const apiSubregionId = num(row.subregion_id);
			return {
				name: String(row.name ?? ""),
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
				regionId: apiRegionId !== null ? (apiRegionById.get(apiRegionId) ?? null) : null,
				subregionId: apiSubregionId !== null ? (apiSubregionById.get(apiSubregionId) ?? null) : null,
			};
		}),
		skipDuplicates: true,
	});

	const allCountries = await prisma.country.findMany();
	const countryByIso2 = new Map(allCountries.map((c) => [c.iso2 ?? "", c.id]));
	console.log(`Seeded ${String(allCountries.length)} countries`);

	// ── States ─────────────────────────────────────────────────────────
	const stateRows = await fetchData("states");
	await prisma.state.createMany({
		data: stateRows
			.map((row) => {
				const countryCode = String(row.country_code ?? "");
				const countryId = countryByIso2.get(countryCode);
				if (!countryId) return null;
				return {
					name: String(row.name ?? ""),
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
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null),
		skipDuplicates: true,
	});

	const allStates = await prisma.state.findMany();
	console.log(`Seeded ${String(allStates.length)} states`);

	// ── Cities (from countries+states+cities.json — nested) ────────────
	const nestedRows = await fetchData("countries%2Bstates%2Bcities");
	let cityCount = 0;

	for (const country of nestedRows) {
		const countryId = countryByIso2.get(String(country.iso2 ?? ""));
		if (!countryId) continue;

		const stateList = country.states as Record<string, unknown>[] | undefined;
		if (!Array.isArray(stateList)) continue;

		for (const state of stateList) {
			// Match state by name + countryId
			const stateName = String(state.name ?? "");
			const matchedState = allStates.find((s) => s.name === stateName && s.countryId === countryId);
			if (!matchedState) continue;

			const cityList = state.cities as Record<string, unknown>[] | undefined;
			if (!Array.isArray(cityList) || cityList.length === 0) continue;

			await prisma.city.createMany({
				data: cityList.map((city) => ({
					name: String(city.name ?? ""),
					stateCode: String(state.iso2 ?? ""),
					countryCode: String(country.iso2 ?? ""),
					latitude: num(city.latitude) ?? 0,
					longitude: num(city.longitude) ?? 0,
					native: str(city.native),
					timezone: str(city.timezone),
					wikiDataId: str(city.wikiDataId),
					stateId: matchedState.id,
					countryId,
				})),
				skipDuplicates: true,
			});
			cityCount += cityList.length;
		}
	}
	console.log(`Seeded ${String(cityCount)} cities`);

	console.log("Geo seeding completed!");
}
