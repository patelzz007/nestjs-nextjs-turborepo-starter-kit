import { describe, expect, it } from "vitest";

import { ALL_LOCATIONS_SCOPE, selectedLocationsScope } from "../types/merchant-location-scope";
import { isLocationInScope, isRewardWithinScope, locationIdInFilter, rewardAvailabilityWhere } from "./merchant-location-scope.util";

const STORE_A = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";
const STORE_B = "5e0b4a6f-3a7c-4d66-9a1d-0b5c2d3e4f50";

describe("selectedLocationsScope", () => {
	it("de-duplicates the stores", () => {
		expect(selectedLocationsScope([STORE_A, STORE_A])).toEqual({ kind: "SELECTED_LOCATIONS", locationIds: [STORE_A] });
	});
});

describe("locationIdInFilter", () => {
	it("adds no store filter for every store", () => {
		expect(locationIdInFilter(ALL_LOCATIONS_SCOPE)).toBeUndefined();
	});

	it("filters to the selected stores, and an empty selection matches nothing", () => {
		expect(locationIdInFilter(selectedLocationsScope([STORE_A]))).toEqual({ in: [STORE_A] });
		expect(locationIdInFilter(selectedLocationsScope([]))).toEqual({ in: [] });
	});
});

describe("isLocationInScope", () => {
	it("admits every row, store-less ones included, for every store", () => {
		expect(isLocationInScope(ALL_LOCATIONS_SCOPE, null)).toBe(true);
		expect(isLocationInScope(ALL_LOCATIONS_SCOPE, STORE_B)).toBe(true);
	});

	it("admits only the selected stores — never an organization-wide (store-less) row", () => {
		const scope = selectedLocationsScope([STORE_A]);
		expect(isLocationInScope(scope, STORE_A)).toBe(true);
		expect(isLocationInScope(scope, STORE_B)).toBe(false);
		expect(isLocationInScope(scope, null)).toBe(false);
	});
});

describe("rewardAvailabilityWhere", () => {
	it("does not narrow for every store", () => {
		expect(rewardAvailabilityWhere(ALL_LOCATIONS_SCOPE)).toEqual({});
	});

	it("keeps organization-wide rewards and those offered at a selected store", () => {
		expect(rewardAvailabilityWhere(selectedLocationsScope([STORE_A]))).toEqual({
			OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [STORE_A] } } } }],
		});
	});
});

describe("isRewardWithinScope", () => {
	it("lets an all-stores actor manage any reward", () => {
		expect(isRewardWithinScope(ALL_LOCATIONS_SCOPE, { locationScopeType: "ALL_LOCATIONS", locationIds: [] })).toBe(true);
	});

	it("lets a store-limited actor manage only rewards offered exclusively at its stores", () => {
		const scope = selectedLocationsScope([STORE_A]);
		expect(isRewardWithinScope(scope, { locationScopeType: "SELECTED", locationIds: [STORE_A] })).toBe(true);
		expect(isRewardWithinScope(scope, { locationScopeType: "SELECTED", locationIds: [STORE_A, STORE_B] })).toBe(false);
		expect(isRewardWithinScope(scope, { locationScopeType: "ALL_LOCATIONS", locationIds: [] })).toBe(false);
		expect(isRewardWithinScope(scope, { locationScopeType: "SELECTED", locationIds: [] })).toBe(false);
	});
});
