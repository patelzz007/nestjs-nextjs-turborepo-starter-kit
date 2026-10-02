// ============================================
// modules/geo/mappers/geo.mappers.ts - Prisma geo rows → shared contract DTOs
// ============================================
// The geo tables hold non-JSON-safe column types: `Decimal` coordinates,
// `BigInt` population / GDP and `TIMESTAMP` dates. Every row leaves the
// repository through one of these mappers, so the controller only ever returns
// the shared DTOs (`RegionSchema` … `CitySchema`, ADR 022) and the response
// interceptor's parse succeeds for real rows:
//
//   Decimal  → number              (`toNumber()`, exact for DECIMAL(10|11, 8))
//   BigInt   → number              (population / GDP are far below 2^53)
//   DateTime → epoch milliseconds    (`GeoDateTimeFieldSchema`, the API-wide time format)
//   Json     → DataValue           (Prisma `JsonValue` is already JSON-safe)

import type { City as CityRow, Country as CountryRow, Prisma, Region as RegionRow, State as StateRow, Subregion as SubregionRow } from "@prisma/client";
import type { City, CityListItem, Country, CountryListItem, DataValue, Region, RegionListItem, State, StateListItem, Subregion, SubregionListItem } from "@workspace/shared";

/** A region row as `findMany` returns it, with the relations `?include=` may have loaded. */
export type RegionListRow = RegionRow & {
	readonly subregions?: readonly SubregionRow[] | undefined;
	readonly countries?: readonly CountryRow[] | undefined;
};

/** A subregion row with the relations `?include=` may have loaded. */
export type SubregionListRow = SubregionRow & {
	readonly region?: RegionRow | undefined;
	readonly countries?: readonly CountryRow[] | undefined;
};

/** A country row with the relations `?include=` may have loaded. */
export type CountryListRow = CountryRow & {
	readonly regionRelation?: RegionRow | null | undefined;
	readonly subregionRelation?: SubregionRow | null | undefined;
	readonly states?: readonly StateRow[] | undefined;
	readonly cities?: readonly CityRow[] | undefined;
};

/** A state row with the relations `?include=` may have loaded. */
export type StateListRow = StateRow & {
	readonly country?: CountryRow | undefined;
	readonly cities?: readonly CityRow[] | undefined;
};

/** A city row with the relations `?include=` may have loaded. */
export type CityListRow = CityRow & {
	readonly state?: StateRow | undefined;
	readonly country?: CountryRow | undefined;
};

// ── Column converters ─────────────────────────────────────────────────────

/** `TIMESTAMP` column → epoch milliseconds (UTC). */
export function toGeoTimestamp(value: Date): number {
	return value.getTime();
}

/** Nullable `DECIMAL` column → number. */
export function toNullableGeoNumber(value: Prisma.Decimal | null): number | null {
	return value === null ? null : value.toNumber();
}

/** Nullable `BIGINT` column → number. */
export function toNullableGeoInteger(value: bigint | null): number | null {
	return value === null ? null : Number(value);
}

/** Nullable `Json` column → the contract's `DataValue`. */
function toNullableDataValue(value: Prisma.JsonValue): DataValue | null {
	return value;
}

// ── Entity mappers ────────────────────────────────────────────────────────

export function toRegionDto(row: RegionRow): Region {
	return {
		id: row.id,
		name: row.name,
		translations: toNullableDataValue(row.translations),
		wikiDataId: row.wikiDataId,
		flag: row.flag,
		createdAt: toGeoTimestamp(row.createdAt),
		updatedAt: toGeoTimestamp(row.updatedAt),
	};
}

export function toSubregionDto(row: SubregionRow): Subregion {
	return {
		id: row.id,
		name: row.name,
		translations: toNullableDataValue(row.translations),
		wikiDataId: row.wikiDataId,
		flag: row.flag,
		regionId: row.regionId,
		createdAt: toGeoTimestamp(row.createdAt),
		updatedAt: toGeoTimestamp(row.updatedAt),
	};
}

export function toCountryDto(row: CountryRow): Country {
	return {
		id: row.id,
		name: row.name,
		iso3: row.iso3,
		numericCode: row.numericCode,
		iso2: row.iso2,
		phonecode: row.phonecode,
		capital: row.capital,
		currency: row.currency,
		currencyName: row.currencyName,
		currencySymbol: row.currencySymbol,
		tld: row.tld,
		native: row.native,
		population: toNullableGeoInteger(row.population),
		gdp: toNullableGeoInteger(row.gdp),
		region: row.region,
		subregion: row.subregion,
		nationality: row.nationality,
		timezones: toNullableDataValue(row.timezones),
		translations: toNullableDataValue(row.translations),
		latitude: toNullableGeoNumber(row.latitude),
		longitude: toNullableGeoNumber(row.longitude),
		emoji: row.emoji,
		emojiU: row.emojiU,
		wikiDataId: row.wikiDataId,
		flag: row.flag,
		regionId: row.regionId,
		subregionId: row.subregionId,
		createdAt: toGeoTimestamp(row.createdAt),
		updatedAt: toGeoTimestamp(row.updatedAt),
	};
}

export function toStateDto(row: StateRow): State {
	return {
		id: row.id,
		name: row.name,
		countryCode: row.countryCode,
		fipsCode: row.fipsCode,
		iso2: row.iso2,
		iso3166_2: row.iso3166_2,
		type: row.type,
		level: row.level,
		parentId: row.parentId,
		native: row.native,
		latitude: toNullableGeoNumber(row.latitude),
		longitude: toNullableGeoNumber(row.longitude),
		timezone: row.timezone,
		translations: toNullableDataValue(row.translations),
		wikiDataId: row.wikiDataId,
		flag: row.flag,
		countryId: row.countryId,
		createdAt: toGeoTimestamp(row.createdAt),
		updatedAt: toGeoTimestamp(row.updatedAt),
	};
}

export function toCityDto(row: CityRow): City {
	return {
		id: row.id,
		name: row.name,
		stateCode: row.stateCode,
		countryCode: row.countryCode,
		latitude: row.latitude.toNumber(),
		longitude: row.longitude.toNumber(),
		native: row.native,
		timezone: row.timezone,
		translations: toNullableDataValue(row.translations),
		wikiDataId: row.wikiDataId,
		flag: row.flag,
		stateId: row.stateId,
		countryId: row.countryId,
		createdAt: toGeoTimestamp(row.createdAt),
		updatedAt: toGeoTimestamp(row.updatedAt),
	};
}

// ── List item mappers (entity + included relations) ──────────────────────
// A relation key is emitted only when `?include=` loaded it, exactly as the
// rows came back from Prisma.

export function toRegionListItem(row: RegionListRow): RegionListItem {
	return {
		...toRegionDto(row),
		...(row.subregions === undefined ? {} : { subregions: row.subregions.map(toSubregionDto) }),
		...(row.countries === undefined ? {} : { countries: row.countries.map(toCountryDto) }),
	};
}

export function toSubregionListItem(row: SubregionListRow): SubregionListItem {
	return {
		...toSubregionDto(row),
		...(row.region === undefined ? {} : { region: toRegionDto(row.region) }),
		...(row.countries === undefined ? {} : { countries: row.countries.map(toCountryDto) }),
	};
}

export function toCountryListItem(row: CountryListRow): CountryListItem {
	const { regionRelation, subregionRelation } = row;
	return {
		...toCountryDto(row),
		...(regionRelation === undefined ? {} : { regionRelation: regionRelation === null ? null : toRegionDto(regionRelation) }),
		...(subregionRelation === undefined ? {} : { subregionRelation: subregionRelation === null ? null : toSubregionDto(subregionRelation) }),
		...(row.states === undefined ? {} : { states: row.states.map(toStateDto) }),
		...(row.cities === undefined ? {} : { cities: row.cities.map(toCityDto) }),
	};
}

export function toStateListItem(row: StateListRow): StateListItem {
	return {
		...toStateDto(row),
		...(row.country === undefined ? {} : { country: toCountryDto(row.country) }),
		...(row.cities === undefined ? {} : { cities: row.cities.map(toCityDto) }),
	};
}

export function toCityListItem(row: CityListRow): CityListItem {
	return {
		...toCityDto(row),
		...(row.state === undefined ? {} : { state: toStateDto(row.state) }),
		...(row.country === undefined ? {} : { country: toCountryDto(row.country) }),
	};
}
