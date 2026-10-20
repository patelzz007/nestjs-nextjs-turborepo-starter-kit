import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toPrismaCreateCity, toPrismaCreateRegion, toPrismaUpdateCountry, toPrismaUpdateRegion } from "../persistence/geo-write-input.mappers";

describe("geo write input mappers", () => {
	it("omits every optional field the caller did not send, so Prisma applies the column default", () => {
		expect(toPrismaCreateRegion({ name: "Asia", flag: true })).toEqual({ name: "Asia", flag: true });
	});

	it("leaves untouched columns out of an update entirely (never `undefined`)", () => {
		const update = toPrismaUpdateRegion({ name: "Asia Pacific" });
		expect(update).toEqual({ name: "Asia Pacific" });
		expect(Object.keys(update)).toEqual(["name"]);
		expect(toPrismaUpdateRegion({})).toEqual({});
	});

	it("turns JSON null into Prisma's DbNull and keeps JSON values", () => {
		expect(toPrismaUpdateRegion({ translations: null })).toEqual({ translations: Prisma.DbNull });
		expect(toPrismaUpdateRegion({ translations: { de: "Asien" } })).toEqual({ translations: { de: "Asien" } });
	});

	it("detaches a country from its parents with explicit nulls", () => {
		expect(toPrismaUpdateCountry({ regionId: null, subregionId: null })).toEqual({ regionId: null, subregionId: null });
	});

	it("passes a city's scalar foreign keys and coordinates through", () => {
		expect(toPrismaCreateCity({ name: "Klang", stateCode: "10", countryCode: "MY", stateId: 1, countryId: 2, latitude: 3.04, longitude: 101.45, flag: true })).toEqual({
			name: "Klang",
			stateCode: "10",
			countryCode: "MY",
			stateId: 1,
			countryId: 2,
			latitude: 3.04,
			longitude: 101.45,
			flag: true,
		});
	});
});
