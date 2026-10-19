import { Prisma, type Country as CountryRow, type Region as RegionRow, type Subregion as SubregionRow } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
	toCountryListItem,
	toGeoTimestamp,
	toNullableGeoInteger,
	toNullableGeoNumber,
	toRegionListItem,
	toSubregionDto,
	toSubregionListItem,
} from "../persistence/geo.mappers";
import { LIVE_ROW_FIELDS } from "../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

const CREATED_AT = BigInt(Date.UTC(2014, 0, 1, 12, 1, 1));
const UPDATED_AT = BigInt(Date.UTC(2026, 8, 30, 8, 15));
const POPULATION = 33_000_000;

const lifecycle = { isDeleted: false, deletedAt: null, deletedBy: null, createdAt: CREATED_AT, updatedAt: UPDATED_AT };
const region: RegionRow = { ...LIVE_ROW_FIELDS, id: 3, name: "Asia", translations: null, wikiDataId: null, flag: true, ...lifecycle };
const subregion: SubregionRow = {
	...LIVE_ROW_FIELDS,
	id: 9,
	name: "South-Eastern Asia",
	translations: { fr: "Asie du Sud-Est" },
	wikiDataId: "Q11708",
	flag: true,
	regionId: 3,
	...lifecycle,
};
const country: CountryRow = {
	...LIVE_ROW_FIELDS,
	id: 132,
	name: "Malaysia",
	iso3: "MYS",
	numericCode: "458",
	iso2: "MY",
	phonecode: "60",
	capital: "Kuala Lumpur",
	currency: "MYR",
	currencyName: "Malaysian ringgit",
	currencySymbol: "RM",
	tld: ".my",
	native: "Malaysia",
	population: BigInt(POPULATION),
	gdp: null,
	region: "Asia",
	subregion: "South-Eastern Asia",
	nationality: "Malaysian",
	timezones: null,
	translations: null,
	latitude: new Prisma.Decimal("2.50000000"),
	longitude: null,
	emoji: null,
	emojiU: null,
	wikiDataId: null,
	flag: true,
	regionId: 3,
	subregionId: null,
	...lifecycle,
};

describe("geo column converters", () => {
	it("turns the epoch-ms BIGINT column into a JSON number", () => {
		expect(toGeoTimestamp(CREATED_AT)).toBe(Date.UTC(2014, 0, 1, 12, 1, 1));
	});

	it("keeps null and converts Decimal / BigInt to numbers", () => {
		expect(toNullableGeoNumber(null)).toBeNull();
		expect(toNullableGeoNumber(new Prisma.Decimal("-33.86880000"))).toBe(-33.8688);
		expect(toNullableGeoInteger(null)).toBeNull();
		expect(toNullableGeoInteger(BigInt(POPULATION))).toBe(POPULATION);
	});
});

describe("geo entity mappers", () => {
	it("maps a subregion without leaking lifecycle columns", () => {
		const dto = toSubregionDto(subregion);
		expect(dto).toEqual({
			id: 9,
			name: "South-Eastern Asia",
			translations: { fr: "Asie du Sud-Est" },
			wikiDataId: "Q11708",
			flag: true,
			regionId: 3,
			createdAt: Number(CREATED_AT),
			updatedAt: Number(UPDATED_AT),
		});
		expect(dto).not.toHaveProperty("isDeleted");
	});
});

describe("geo list item mappers", () => {
	it("emits a relation key only when the include loaded it", () => {
		expect(toRegionListItem(region)).not.toHaveProperty("subregions");
		expect(toRegionListItem({ ...region, subregions: [subregion] }).subregions).toEqual([toSubregionDto(subregion)]);
		expect(toSubregionListItem({ ...subregion, region })).toMatchObject({ region: { id: 3, name: "Asia" } });
	});

	it("keeps an included-but-absent optional parent as null", () => {
		const item = toCountryListItem({ ...country, regionRelation: null, subregionRelation: null });
		expect(item).toMatchObject({ regionRelation: null, subregionRelation: null, population: POPULATION, latitude: 2.5, longitude: null });
		expect(item).not.toHaveProperty("states");
	});
});
