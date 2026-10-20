import { describe, expect, it } from "vitest";

import { RewardLocationForbiddenError, RewardLocationInvalidError } from "../errors/reward.errors";
import { decideRewardLocationScope } from "../policies/reward-location-scope.policy";
import { RewardLocationScope } from "../value-objects/reward-location-scope.value-object";
import { STORE_A, STORE_B } from "./reward-state.fixture";

const STORE_C = "77777777-7777-4777-8777-777777777777";

describe("decideRewardLocationScope", () => {
	describe("an all-stores merchant", () => {
		it("makes every reward tenant-wide in a tenant with at most one store", () => {
			for (const activeLocationCount of [0, 1]) {
				const scope = decideRewardLocationScope(null, { activeLocationCount, activeRequestedLocationIds: [STORE_A] }, { scopeType: "SELECTED", locationIds: [STORE_A] });
				expect(scope.equals(RewardLocationScope.allLocations())).toBe(true);
			}
		});

		it("keeps a tenant-wide request tenant-wide", () => {
			const scope = decideRewardLocationScope(null, { activeLocationCount: 3, activeRequestedLocationIds: [] }, { scopeType: "ALL_LOCATIONS", locationIds: [] });
			expect(scope.type).toBe("ALL_LOCATIONS");
		});

		it("selects the requested active stores, once each", () => {
			const scope = decideRewardLocationScope(
				null,
				{ activeLocationCount: 3, activeRequestedLocationIds: [STORE_A, STORE_B] },
				{ scopeType: "SELECTED", locationIds: [STORE_A, STORE_B, STORE_A] },
			);
			expect(scope.equals(RewardLocationScope.selected([STORE_A, STORE_B]))).toBe(true);
		});

		it("refuses a store that is not an active store of the tenant (400)", () => {
			expect(() =>
				decideRewardLocationScope(null, { activeLocationCount: 3, activeRequestedLocationIds: [STORE_A] }, { scopeType: "SELECTED", locationIds: [STORE_A, STORE_C] }),
			).toThrow(RewardLocationInvalidError);
		});
	});

	describe("a store-limited merchant", () => {
		const own = [STORE_A, STORE_B];

		it("may offer a reward at its own stores", () => {
			const scope = decideRewardLocationScope(own, { activeLocationCount: 3, activeRequestedLocationIds: [STORE_A] }, { scopeType: "SELECTED", locationIds: [STORE_A] });
			expect(scope.equals(RewardLocationScope.selected([STORE_A]))).toBe(true);
		});

		it("is selected even in a one-store tenant", () => {
			const scope = decideRewardLocationScope([STORE_A], { activeLocationCount: 1, activeRequestedLocationIds: [STORE_A] }, { scopeType: "SELECTED", locationIds: [STORE_A] });
			expect(scope.type).toBe("SELECTED");
		});

		it("may not ask for every store (403)", () => {
			expect(() => decideRewardLocationScope(own, { activeLocationCount: 3, activeRequestedLocationIds: [] }, { scopeType: "ALL_LOCATIONS", locationIds: [] })).toThrow(
				RewardLocationForbiddenError,
			);
		});

		it("may not name another store (403) — forbidden wins over invalid", () => {
			expect(() =>
				decideRewardLocationScope(own, { activeLocationCount: 3, activeRequestedLocationIds: [] }, { scopeType: "SELECTED", locationIds: [STORE_A, STORE_C] }),
			).toThrow(RewardLocationForbiddenError);
		});

		it("refuses one of its own stores that is no longer active (400)", () => {
			expect(() =>
				decideRewardLocationScope(own, { activeLocationCount: 3, activeRequestedLocationIds: [STORE_A] }, { scopeType: "SELECTED", locationIds: [STORE_A, STORE_B] }),
			).toThrow(RewardLocationInvalidError);
		});
	});
});

describe("RewardLocationScope.isManageableBy", () => {
	it.each([
		["an all-stores merchant, tenant-wide reward", RewardLocationScope.allLocations(), null, true],
		["a store-limited merchant, tenant-wide reward", RewardLocationScope.allLocations(), [STORE_A], false],
		["a store-limited merchant, reward inside its stores", RewardLocationScope.selected([STORE_A]), [STORE_A, STORE_B], true],
		["a store-limited merchant, reward also at another store", RewardLocationScope.selected([STORE_A, STORE_C]), [STORE_A, STORE_B], false],
		["a store-limited merchant, selected reward with no stores left", RewardLocationScope.selected([]), [STORE_A], false],
	])("%s", (_label, scope, manager, expected) => {
		expect(scope.isManageableBy(manager)).toBe(expected);
	});

	it("reads storage: tenant-wide drops stored store ids", () => {
		expect(RewardLocationScope.fromStorage("ALL_LOCATIONS", [STORE_A]).locationIds).toEqual([]);
		expect(RewardLocationScope.fromStorage("SELECTED", [STORE_A]).locationIds).toEqual([STORE_A]);
	});

	it("compares by type and stores in order", () => {
		expect(RewardLocationScope.selected([STORE_A, STORE_B]).equals(RewardLocationScope.selected([STORE_B, STORE_A]))).toBe(false);
		expect(RewardLocationScope.selected([STORE_A]).equals(RewardLocationScope.allLocations())).toBe(false);
	});
});
