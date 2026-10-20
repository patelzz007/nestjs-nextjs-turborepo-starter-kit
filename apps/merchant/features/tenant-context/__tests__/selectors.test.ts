import { describe, expect, it } from "vitest";

import type { MemberLocationAccess } from "@/contexts/tenancy/lib/org/location-access";
import { locationFixture, STORE_A_LOCATION, STORE_B_LOCATION } from "@/test/tenant-context";
import { STORE_A, STORE_B } from "@/test/terminals";
import type { LocationResponse } from "@workspace/shared";

import { resolveActiveLocation, resolveEffectiveLocationId, toLocationQueryInput } from "../selectors";

const REMOVED_STORE_ID = "0f0f0f0f-0000-4000-8000-0000000000ff";
const TWO_STORES = [STORE_A_LOCATION, STORE_B_LOCATION];

/** An `ALL_LOCATIONS` member's access to `locations`. */
function tenantWide(locations: readonly LocationResponse[]): MemberLocationAccess {
	return { locations, hasTenantWideAccess: true };
}

/** A store-limited (`SELECTED`) member's access to `locations`. */
function storeLimited(locations: readonly LocationResponse[]): MemberLocationAccess {
	return { locations, hasTenantWideAccess: false };
}

describe("resolveEffectiveLocationId", () => {
	it("keeps a choice the member can still access", () => {
		expect(resolveEffectiveLocationId(STORE_B.id, tenantWide(TWO_STORES))).toBe(STORE_B.id);
	});

	it("falls back to all stores when the stored choice is no longer accessible and all stores are allowed", () => {
		expect(resolveEffectiveLocationId(REMOVED_STORE_ID, tenantWide(TWO_STORES))).toBeNull();
	});

	it("shows all stores when nothing was chosen and the member may see org-wide rollups", () => {
		expect(resolveEffectiveLocationId(null, tenantWide(TWO_STORES))).toBeNull();
	});

	it("never offers all stores to a store-limited member, even with several stores — the client stays inside the member's scope", () => {
		expect(resolveEffectiveLocationId(null, storeLimited(TWO_STORES))).toBe(STORE_A.id);
		expect(resolveEffectiveLocationId(REMOVED_STORE_ID, storeLimited(TWO_STORES))).toBe(STORE_A.id);
		expect(resolveEffectiveLocationId(STORE_B.id, storeLimited(TWO_STORES))).toBe(STORE_B.id);
	});

	it("auto-selects a single-store member's only store — all stores is not an option for them", () => {
		expect(resolveEffectiveLocationId(null, tenantWide([STORE_A_LOCATION]))).toBe(STORE_A.id);
		expect(resolveEffectiveLocationId(REMOVED_STORE_ID, tenantWide([STORE_A_LOCATION]))).toBe(STORE_A.id);
	});

	it("filters by nothing when the member has no accessible store", () => {
		expect(resolveEffectiveLocationId(STORE_A.id, storeLimited([]))).toBeNull();
	});

	it("uses the choice as made while the locations are still loading (provisional — re-derived once they arrive)", () => {
		expect(resolveEffectiveLocationId(STORE_B.id, undefined)).toBe(STORE_B.id);
		expect(resolveEffectiveLocationId(null, undefined)).toBeNull();
	});

	it("never picks a store outside the accessible list, even a real store of the tenant", () => {
		const pendingStore = locationFixture({ id: REMOVED_STORE_ID, name: "Pending" }, "PENDING_APPROVAL");

		expect(resolveEffectiveLocationId(pendingStore.id, tenantWide(TWO_STORES))).toBeNull();
	});
});

describe("resolveActiveLocation", () => {
	it("returns the record of the store in effect", () => {
		expect(resolveActiveLocation(STORE_B.id, TWO_STORES)).toBe(STORE_B_LOCATION);
	});

	it("has none for all stores or before the locations load", () => {
		expect(resolveActiveLocation(null, TWO_STORES)).toBeUndefined();
		expect(resolveActiveLocation(STORE_B.id, undefined)).toBeUndefined();
	});
});

describe("toLocationQueryInput", () => {
	it("omits the filter for all stores and passes a store id through", () => {
		expect(toLocationQueryInput(null)).toBeUndefined();
		expect(toLocationQueryInput(STORE_A.id)).toBe(STORE_A.id);
	});
});
