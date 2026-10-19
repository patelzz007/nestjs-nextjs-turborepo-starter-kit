import { CityListQuerySchema, CountryListQuerySchema, RegionListQuerySchema, StateListQuerySchema, SubregionListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	buildCityListWhere,
	buildCountryListWhere,
	buildRegionListWhere,
	buildStateListWhere,
	buildSubregionListWhere,
	COUNTRY_INCLUDES,
	LIVE_ONLY,
	parseInclude,
	REGION_INCLUDES,
} from "../persistence/geo-list-query";

describe("geo list where builders", () => {
	it("excludes soft-deleted rows in every geo list, even without filters", () => {
		expect(buildRegionListWhere(RegionListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildSubregionListWhere(SubregionListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildCountryListWhere(CountryListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildStateListWhere(StateListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildCityListWhere(CityListQuerySchema.parse({}), undefined)).toEqual({ AND: [{ isDeleted: false }] });
	});

	it("narrows to the fuzzy-search ids and maps code filters case-insensitively", () => {
		const query = CityListQuerySchema.parse({ filter: { countryCode: { eq: "my" }, stateId: { in: "1,2" } } });
		expect(buildCityListWhere(query, [3, 4])).toEqual({
			AND: [{ isDeleted: false }, { stateId: { in: [1, 2] } }, { countryCode: { equals: "my", mode: "insensitive" } }, { id: { in: [3, 4] } }],
		});
	});

	it("an empty search result narrows to nothing rather than to everything", () => {
		expect(buildRegionListWhere(RegionListQuerySchema.parse({}), [])).toEqual({ AND: [{ isDeleted: false }, { id: { in: [] } }] });
	});

	it("maps a subregion's regionId and a state's countryId filters onto their columns", () => {
		expect(buildSubregionListWhere(SubregionListQuerySchema.parse({ filter: { regionId: { eq: "3" } } }), undefined).AND).toContainEqual({ regionId: { equals: 3 } });
		expect(buildStateListWhere(StateListQuerySchema.parse({ filter: { countryId: { eq: "132" } } }), undefined).AND).toContainEqual({ countryId: { equals: 132 } });
	});
});

describe("parseInclude", () => {
	it("is undefined without an include, or when no token matches", () => {
		expect(parseInclude(undefined, REGION_INCLUDES)).toBeUndefined();
		expect(parseInclude("", REGION_INCLUDES)).toBeUndefined();
		expect(parseInclude("cities", REGION_INCLUDES)).toBeUndefined();
	});

	it("merges the matching fragments, trimming tokens, and loads only live children", () => {
		expect(parseInclude(" subregions , countries", REGION_INCLUDES)).toEqual({ subregions: LIVE_ONLY, countries: LIVE_ONLY });
		expect(parseInclude("region,states", COUNTRY_INCLUDES)).toEqual({ regionRelation: true, states: LIVE_ONLY });
	});
});
