import { describe, expect, it } from "vitest";

import { GEO_CASCADE_LEVELS } from "../../domain/policies/geo-cascade.policy";
import type { GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";
import { GEO_CASCADE_WHERE, linkedCascadeLevels } from "../persistence/geo-cascade.where";

const ROOTS: readonly GeoParentKind[] = ["region", "subregion", "country", "state"];
const ID = 42;

describe("GEO_CASCADE_WHERE", () => {
	it.each(ROOTS)("links exactly the levels the domain policy says a %s reaches", (entity) => {
		expect(linkedCascadeLevels(entity)).toEqual(GEO_CASCADE_LEVELS[entity]);
	});

	it("reaches a region's states through their country and its cities through their state's country", () => {
		expect(GEO_CASCADE_WHERE.region.subregions?.(ID)).toEqual({ regionId: ID });
		expect(GEO_CASCADE_WHERE.region.countries?.(ID)).toEqual({ regionId: ID });
		expect(GEO_CASCADE_WHERE.region.states?.(ID)).toEqual({ country: { regionId: ID } });
		expect(GEO_CASCADE_WHERE.region.cities?.(ID)).toEqual({ state: { country: { regionId: ID } } });
	});

	it("reaches a subregion's countries by subregionId, never its region's other countries", () => {
		expect(GEO_CASCADE_WHERE.subregion.countries?.(ID)).toEqual({ subregionId: ID });
		expect(GEO_CASCADE_WHERE.subregion.states?.(ID)).toEqual({ country: { subregionId: ID } });
		expect(GEO_CASCADE_WHERE.subregion.cities?.(ID)).toEqual({ state: { country: { subregionId: ID } } });
	});

	it("reaches a country's and a state's children by their own foreign key", () => {
		expect(GEO_CASCADE_WHERE.country.states?.(ID)).toEqual({ countryId: ID });
		expect(GEO_CASCADE_WHERE.country.cities?.(ID)).toEqual({ countryId: ID });
		expect(GEO_CASCADE_WHERE.state.cities?.(ID)).toEqual({ stateId: ID });
	});
});
