import type { Prisma } from "@prisma/client";
import type {
	CreateCityInput,
	CreateCountryInput,
	CreateRegionInput,
	CreateStateInput,
	CreateSubregionInput,
	UpdateCityInput,
	UpdateCountryInput,
	UpdateRegionInput,
	UpdateStateInput,
	UpdateSubregionInput,
} from "@workspace/shared";

import { parsePrismaNullableDataValue } from "../../../../platform/infrastructure/utils/prisma-json";

// ── DTO → Prisma input mappers ────────────────────────────────────────────────
// Contract DTOs (zod outputs) carry scalar foreign keys and nullable `DataValue`
// JSON fields. Prisma's *Unchecked* inputs accept the scalar FKs directly, and
// JSON `null` must become the `DbNull` sentinel — `parsePrismaNullableDataValue`
// converts and runtime-validates it. Optional fields the caller did not supply
// are omitted (never passed as `undefined`), so Prisma leaves those columns
// untouched on update and applies the column default on create.

export function toPrismaCreateRegion(input: CreateRegionInput): Prisma.RegionUncheckedCreateInput {
	return {
		name: input.name,
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
	};
}

export function toPrismaUpdateRegion(input: UpdateRegionInput): Prisma.RegionUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
	};
}

export function toPrismaCreateSubregion(input: CreateSubregionInput): Prisma.SubregionUncheckedCreateInput {
	return {
		name: input.name,
		regionId: input.regionId,
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		flag: input.flag,
	};
}

export function toPrismaUpdateSubregion(input: UpdateSubregionInput): Prisma.SubregionUncheckedUpdateInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.regionId === undefined ? {} : { regionId: input.regionId }),
		...(input.translations === undefined ? {} : { translations: parsePrismaNullableDataValue(input.translations) }),
		...(input.wikiDataId === undefined ? {} : { wikiDataId: input.wikiDataId }),
		...(input.flag === undefined ? {} : { flag: input.flag }),
	};
}

export function toPrismaCreateCountry(input: CreateCountryInput): Prisma.CountryUncheckedCreateInput {
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

export function toPrismaUpdateCountry(input: UpdateCountryInput): Prisma.CountryUncheckedUpdateInput {
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

export function toPrismaCreateState(input: CreateStateInput): Prisma.StateUncheckedCreateInput {
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

export function toPrismaUpdateState(input: UpdateStateInput): Prisma.StateUncheckedUpdateInput {
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

export function toPrismaCreateCity(input: CreateCityInput): Prisma.CityUncheckedCreateInput {
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

export function toPrismaUpdateCity(input: UpdateCityInput): Prisma.CityUncheckedUpdateInput {
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
