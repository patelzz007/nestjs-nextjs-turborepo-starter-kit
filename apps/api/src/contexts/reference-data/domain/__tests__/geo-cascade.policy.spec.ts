import { describe, expect, it } from "vitest";

import { cascadeDeleteOrder, GEO_CASCADE_LEVELS, type GeoChildLevel } from "../policies/geo-cascade.policy";
import { GEO_ENTITY_KINDS, GEO_ENTITY_LABEL, type GeoEntityKind } from "../value-objects/geo-entity-kind.value-object";

const TOP_DOWN: readonly GeoChildLevel[] = ["subregions", "countries", "states", "cities"];

describe("GEO_CASCADE_LEVELS", () => {
	it.each<[GeoEntityKind, readonly GeoChildLevel[]]>([
		["region", ["subregions", "countries", "states", "cities"]],
		["subregion", ["countries", "states", "cities"]],
		["country", ["states", "cities"]],
		["state", ["cities"]],
		["city", []],
	])("a %s reaches exactly %j", (entity, levels) => {
		expect(GEO_CASCADE_LEVELS[entity]).toEqual(levels);
	});

	it("names every level of the hierarchy", () => {
		expect(Object.keys(GEO_CASCADE_LEVELS).sort()).toEqual([...GEO_ENTITY_KINDS].sort());
	});

	it("lists each root's levels top-down, never a level above the root", () => {
		for (const entity of GEO_ENTITY_KINDS) {
			const levels = GEO_CASCADE_LEVELS[entity];
			expect(levels).toEqual(TOP_DOWN.filter((level) => levels.includes(level)));
		}
	});

	it("a deeper root never reaches more than its parent", () => {
		const [region, subregion, country, state, city] = GEO_ENTITY_KINDS.map((entity) => GEO_CASCADE_LEVELS[entity].length);
		expect([region, subregion, country, state, city]).toEqual([4, 3, 2, 1, 0]);
	});
});

describe("cascadeDeleteOrder", () => {
	it("soft-deletes bottom-up: cities first, subregions last", () => {
		expect(cascadeDeleteOrder("region")).toEqual(["cities", "states", "countries", "subregions"]);
		expect(cascadeDeleteOrder("subregion")).toEqual(["cities", "states", "countries"]);
		expect(cascadeDeleteOrder("country")).toEqual(["cities", "states"]);
		expect(cascadeDeleteOrder("state")).toEqual(["cities"]);
	});

	it("deletes nothing under a city", () => {
		expect(cascadeDeleteOrder("city")).toEqual([]);
	});

	it("never reorders the policy table itself", () => {
		cascadeDeleteOrder("region");
		expect(GEO_CASCADE_LEVELS.region).toEqual(TOP_DOWN);
	});
});

describe("GEO_ENTITY_LABEL", () => {
	it("labels every level for client messages", () => {
		expect(GEO_ENTITY_KINDS.map((entity) => GEO_ENTITY_LABEL[entity])).toEqual(["Region", "Subregion", "Country", "State", "City"]);
	});
});
