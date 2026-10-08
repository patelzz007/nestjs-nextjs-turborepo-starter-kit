import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Prisma, type City as CityRow, type Country as CountryRow, type Region as RegionRow, type State as StateRow } from "@prisma/client";
import {
	API_VERSION_PREFIX,
	ApiPaginatedMetaSchema,
	CascadePreviewResultSchema,
	CityListItemSchema,
	CitySchema,
	CountryListItemSchema,
	CountrySchema,
	GeoAutocompleteResponseSchema,
	GeoExportResponseSchema,
	GeoStatsSchema,
	RegionSchema,
	StateListItemSchema,
	StateSchema,
} from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { toCityDto, toCountryDto, toCountryListItem, toRegionDto, toStateDto } from "../src/modules/geo/mappers/geo.mappers";
import { createE2eApp, login, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * Geo response contracts (ADR 022): every geo row leaves the repository as the
 * shared DTO — Decimal coordinates and BigInt population as numbers, dates as
 * epoch milliseconds — and the response interceptor's parse succeeds for REAL rows.
 * Part 1 maps realistic Prisma rows (pure); part 2 calls the live READ
 * endpoints against the seeded geo reference data (dr5hn dataset). The write
 * endpoints are covered by test/geo-writes.e2e-spec.ts.
 */

const GEO_URL = `${API_VERSION_PREFIX}/geo`;
const HTTP_OK = 200;
const IMPORTED_AT = new Date("2014-01-01T12:01:01.000Z");
const UPDATED_AT = new Date("2026-09-30T08:15:00.000Z");
/** A small country (few cities) so the export stays cheap. */
const SMALL_COUNTRY_ISO2 = "AD";
const AFGHANISTAN_POPULATION = 43_844_000;
/** "Andorra" misspelled: no substring (ILIKE) match, only a trigram-similarity one. */
const MISSPELLED_COUNTRY_SEARCH = "Andora";
const CITY_SEARCH = "Kuala Lumpur";
const STATE_SEARCH = "Malacca";
const REGION_SEARCH = "Asia";

const regionRow: RegionRow = {
	id: 1,
	name: "Asia",
	translations: { de: "Asien" },
	wikiDataId: "Q48",
	flag: true,
	isDeleted: false,
	deletedAt: null,
	deletedBy: null,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

const countryRow: CountryRow = {
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
	population: BigInt(AFGHANISTAN_POPULATION),
	gdp: null,
	region: "Asia",
	subregion: "Southern Asia",
	nationality: "Afghan",
	timezones: [{ zoneName: "Asia/Kabul", gmtOffset: 16_200 }],
	translations: null,
	latitude: new Prisma.Decimal("33.00000000"),
	longitude: new Prisma.Decimal("65.00000000"),
	emoji: "🇦🇫",
	emojiU: "U+1F1E6 U+1F1EB",
	wikiDataId: "Q889",
	flag: true,
	isDeleted: false,
	deletedAt: null,
	deletedBy: null,
	regionId: 1,
	subregionId: null,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

const stateRow: StateRow = {
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
	latitude: new Prisma.Decimal("34.55534940"),
	longitude: null,
	timezone: "Asia/Kabul",
	translations: null,
	wikiDataId: null,
	flag: true,
	isDeleted: false,
	deletedAt: null,
	deletedBy: null,
	countryId: 251,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

const cityRow: CityRow = {
	id: 52,
	name: "Kabul",
	stateCode: "KAB",
	countryCode: "AF",
	latitude: new Prisma.Decimal("34.52813000"),
	longitude: new Prisma.Decimal("69.17233000"),
	native: null,
	timezone: "Asia/Kabul",
	translations: null,
	wikiDataId: "Q5838",
	flag: true,
	isDeleted: false,
	deletedAt: null,
	deletedBy: null,
	stateId: 3901,
	countryId: 251,
	createdAt: IMPORTED_AT,
	updatedAt: UPDATED_AT,
};

describe("geo mappers: Prisma row → shared DTO", () => {
	it("maps a country: Decimal → number, BigInt → number, Date → epoch ms, Json kept", () => {
		const dto = toCountryDto(countryRow);
		expect(dto.latitude).toBe(33);
		expect(dto.longitude).toBe(65);
		expect(dto.population).toBe(AFGHANISTAN_POPULATION);
		expect(dto.gdp).toBeNull();
		expect(dto.timezones).toEqual([{ zoneName: "Asia/Kabul", gmtOffset: 16_200 }]);
		expect(dto.createdAt).toBe(IMPORTED_AT.getTime());
		expect(CountrySchema.parse(dto)).toEqual(dto);
	});

	it("maps a state with a null coordinate and a city with required coordinates", () => {
		const state = toStateDto(stateRow);
		expect(state.latitude).toBe(34.5553494);
		expect(state.longitude).toBeNull();
		expect(StateSchema.parse(state)).toEqual(state);

		const city = toCityDto(cityRow);
		expect(city.latitude).toBe(34.52813);
		expect(city.longitude).toBe(69.17233);
		expect(CitySchema.parse(city)).toEqual(city);
	});

	it("maps a region", () => {
		const region = toRegionDto(regionRow);
		expect(region.updatedAt).toBe(UPDATED_AT.getTime());
		expect(RegionSchema.parse(region)).toEqual(region);
	});

	it("maps a country list item: only the included relations, nested rows mapped too", () => {
		expect(toCountryListItem(countryRow)).toEqual(toCountryDto(countryRow));

		const item = toCountryListItem({ ...countryRow, regionRelation: regionRow, subregionRelation: null, states: [stateRow], cities: [cityRow] });
		expect(item.regionRelation).toEqual(toRegionDto(regionRow));
		expect(item.subregionRelation).toBeNull();
		expect(item.states).toEqual([toStateDto(stateRow)]);
		expect(item.cities).toEqual([toCityDto(cityRow)]);
		expect(CountryListItemSchema.parse(item)).toEqual(item);
	});
});

const PaginatedEnvelopeSchema = <TItem extends z.ZodType>(
	item: TItem,
): z.ZodObject<{ success: z.ZodLiteral<true>; data: z.ZodArray<TItem>; meta: typeof ApiPaginatedMetaSchema }> =>
	z.object({ success: z.literal(true), data: z.array(item), meta: ApiPaginatedMetaSchema });

describe("geo endpoints answer with their response contracts (e2e, real Postgres)", () => {
	let app: NestFastifyApplication;
	let session: LoginResult;

	function cookie(): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	async function get(path: string): Promise<InjectResponse> {
		const response = await app.inject({ method: "GET", url: `${GEO_URL}${path}`, headers: { cookie: cookie() } });
		if (response.statusCode !== HTTP_OK) {
			throw new Error(`GET ${path} → ${String(response.statusCode)} ${response.body}`);
		}
		return response;
	}

	async function smallCountry(): Promise<z.output<typeof CountryListItemSchema>> {
		const body = PaginatedEnvelopeSchema(CountryListItemSchema).parse((await get(`/countries?filter[iso2]=${SMALL_COUNTRY_ISO2}&include=region,states`)).json());
		const [country] = body.data;
		if (country === undefined) {
			throw new Error(`Geo seed data missing country ${SMALL_COUNTRY_ISO2} — run the geo seed.`);
		}
		return country;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		session = await login(app, "superadmin@example.com", "SuperAdmin@123");
	});

	afterAll(async () => {
		await app.close();
	});

	it("GET /geo/stats", async () => {
		const { data } = parseSuccessEnvelope(await get("/stats"), GeoStatsSchema);
		expect(data.countries).toBeGreaterThan(0);
	});

	it("GET /geo/countries?include= keeps the included relations, with numeric coordinates", async () => {
		const country = await smallCountry();
		expect(country.iso2).toBe(SMALL_COUNTRY_ISO2);
		expect(country.latitude).toEqual(expect.any(Number));
		expect(country.regionRelation?.name).toBe(country.region);
		expect(country.states?.length).toBeGreaterThan(0);
	});

	it("GET /geo/countries/:id, /geo/states?include=country and /geo/cities/:id parse with the entity schemas", async () => {
		const country = await smallCountry();
		const detail = parseSuccessEnvelope(await get(`/countries/${String(country.id)}`), CountrySchema).data;
		expect(detail.population).toBe(country.population);
		expect(detail).not.toHaveProperty("states");

		const states = PaginatedEnvelopeSchema(StateListItemSchema).parse((await get(`/states?filter[countryId]=${String(country.id)}&include=country&limit=1`)).json());
		const [state] = states.data;
		expect(state?.country?.id).toBe(country.id);

		const cities = PaginatedEnvelopeSchema(CityListItemSchema).parse((await get(`/cities?filter[countryId]=${String(country.id)}&limit=1`)).json());
		const [city] = cities.data;
		if (city === undefined) {
			throw new Error(`Geo seed data has no city for ${SMALL_COUNTRY_ISO2}.`);
		}
		const cityDetail = parseSuccessEnvelope(await get(`/cities/${String(city.id)}`), CitySchema).data;
		expect(cityDetail).toEqual(city);
		expect(cityDetail.latitude).toEqual(expect.any(Number));
	});

	it("GET /geo/export returns the city rows of the matching country", async () => {
		const { data } = parseSuccessEnvelope(await get(`/export?countryCode=${SMALL_COUNTRY_ISO2}`), GeoExportResponseSchema);
		expect(data.length).toBeGreaterThan(0);
		expect(data.every((city) => city.countryCode === SMALL_COUNTRY_ISO2)).toBe(true);
	});

	it("GET /geo/<entity>?search= ranks by pg_trgm similarity, so a misspelling still finds the row", async () => {
		const countries = PaginatedEnvelopeSchema(CountryListItemSchema).parse((await get(`/countries?search=${MISSPELLED_COUNTRY_SEARCH}`)).json());
		expect(countries.data.map((country) => country.iso2)).toContain(SMALL_COUNTRY_ISO2);

		const cities = PaginatedEnvelopeSchema(CityListItemSchema).parse((await get(`/cities?search=${encodeURIComponent(CITY_SEARCH)}`)).json());
		expect(cities.data.some((city) => city.name === CITY_SEARCH)).toBe(true);

		const states = PaginatedEnvelopeSchema(StateListItemSchema).parse((await get(`/states?search=${encodeURIComponent(STATE_SEARCH)}`)).json());
		expect(states.data.some((state) => state.name === STATE_SEARCH)).toBe(true);

		const regions = PaginatedEnvelopeSchema(RegionSchema).parse((await get(`/regions?search=${REGION_SEARCH}`)).json());
		expect(regions.data.map((region) => region.name)).toContain(REGION_SEARCH);
	});

	it("GET /geo/autocomplete and /geo/cascade-preview", async () => {
		const country = await smallCountry();
		const { data: matches } = parseSuccessEnvelope(await get(`/autocomplete?q=${country.name}&country=${SMALL_COUNTRY_ISO2}`), GeoAutocompleteResponseSchema);
		expect(matches.some((item) => item.entityType === "country" && item.id === country.id)).toBe(true);

		const { data: preview } = parseSuccessEnvelope(await get(`/cascade-preview?entity=country&id=${String(country.id)}`), CascadePreviewResultSchema);
		expect(preview.name).toBe(country.name);
		expect(preview.willDelete.cities).toBeGreaterThan(0);
	});
});
