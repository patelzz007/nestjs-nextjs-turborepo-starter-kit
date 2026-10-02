import { describe, expect, it } from "vitest";

import { CityListItemSchema, CountryListItemSchema, RegionListItemSchema } from "./geo-list-items";
import { CitySchema, type City } from "./geo-city";
import { CountrySchema, type Country } from "./geo-country";
import { RegionSchema, type Region } from "./geo-region";
import { GeoDateTimeFieldSchema } from "./geo-shared";
import { StateSchema, type State } from "./geo-state";
import { GeoExportResponseSchema } from "./geo-tools";

/** 2014-01-01T12:01:01.000Z — the dataset's import date, in epoch ms. */
const IMPORTED_AT = 1_388_577_661_000;
/** 2026-09-30T08:15:00.000Z in epoch ms. */
const UPDATED_AT = 1_790_756_100_000;
/** An ISO string — the shape the geo contract no longer sends. */
const ISO_TIMESTAMP = "2014-01-01T12:01:01.000Z";

const region: Region = {
	id: 1,
	name: "Asia",
	translations: { de: "Asien", fr: "Asie" },
	wikiDataId: "Q48",
	flag: true,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

const country: Country = {
	id: 251,
	name: "Afghanistan",
	iso3: "AFG",
	numericCode: "004",
	iso2: "AF",
	phonecode: "93",
	capital: "Kabul",
	currency: "AFN",
	currencyName: "Afghan afghani",
	currencySymbol: "؋",
	tld: ".af",
	native: "افغانستان",
	population: 43_844_000,
	gdp: null,
	region: "Asia",
	subregion: "Southern Asia",
	nationality: "Afghan",
	timezones: [{ zoneName: "Asia/Kabul", gmtOffset: 16_200 }],
	translations: { de: "Afghanistan" },
	latitude: 33,
	longitude: 65,
	emoji: "🇦🇫",
	emojiU: "U+1F1E6 U+1F1EB",
	wikiDataId: "Q889",
	flag: true,
	regionId: 1,
	subregionId: null,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

const state: State = {
	id: 3901,
	name: "Kabul",
	countryCode: "AF",
	fipsCode: "13",
	iso2: "KAB",
	iso3166_2: "AF-KAB",
	type: "province",
	level: null,
	parentId: null,
	native: null,
	latitude: 34.5553494,
	longitude: 69.207486,
	timezone: "Asia/Kabul",
	translations: null,
	wikiDataId: null,
	flag: true,
	countryId: 251,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

const city: City = {
	id: 52,
	name: "Kabul",
	stateCode: "KAB",
	countryCode: "AF",
	latitude: 34.52813,
	longitude: 69.17233,
	native: null,
	timezone: "Asia/Kabul",
	translations: null,
	wikiDataId: "Q5838",
	flag: true,
	stateId: 3901,
	countryId: 251,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

describe("GeoDateTimeFieldSchema", () => {
	it("accepts the epoch-ms timestamps the API sends", () => {
		expect(GeoDateTimeFieldSchema.parse(IMPORTED_AT)).toBe(IMPORTED_AT);
	});

	it("rejects ISO strings, fractional and negative values", () => {
		expect(GeoDateTimeFieldSchema.safeParse(ISO_TIMESTAMP).success).toBe(false);
		expect(GeoDateTimeFieldSchema.safeParse(IMPORTED_AT + 0.5).success).toBe(false);
		expect(GeoDateTimeFieldSchema.safeParse(-1).success).toBe(false);
	});
});

describe("geo entity response schemas (open, strip unknown keys)", () => {
	it("round-trip every entity intact", () => {
		expect(RegionSchema.parse(region)).toEqual(region);
		expect(CountrySchema.parse(country)).toEqual(country);
		expect(StateSchema.parse(state)).toEqual(state);
		expect(CitySchema.parse(city)).toEqual(city);
	});

	it("strip an unknown key instead of rejecting the row", () => {
		expect(CitySchema.parse({ ...city, internalNote: "not for the wire" })).toEqual(city);
	});
});

describe("geo list item schemas (?include= relations)", () => {
	it("keep a region's included countries intact", () => {
		const item = { ...region, countries: [country] };
		expect(RegionListItemSchema.parse(item)).toEqual(item);
	});

	it("keep a country's nullable and array relations intact", () => {
		const item = { ...country, regionRelation: region, subregionRelation: null, states: [state], cities: [city] };
		expect(CountryListItemSchema.parse(item)).toEqual(item);
	});

	it("keep a city's included state and country intact", () => {
		const item = { ...city, state, country };
		expect(CityListItemSchema.parse(item)).toEqual(item);
	});

	it("omit relations that were not included", () => {
		expect(CityListItemSchema.parse(city)).toEqual(city);
	});
});

describe("GeoExportResponseSchema", () => {
	it("keeps every city field (a region-first union would have stripped them)", () => {
		expect(GeoExportResponseSchema.parse([city])).toEqual([city]);
	});

	it("rejects rows of another geo level", () => {
		expect(GeoExportResponseSchema.safeParse([region]).success).toBe(false);
	});
});
