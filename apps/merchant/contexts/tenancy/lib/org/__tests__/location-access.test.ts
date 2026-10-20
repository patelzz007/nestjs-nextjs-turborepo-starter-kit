import { describe, expect, it } from "vitest";

import {
	canSelectAllLocations,
	resolveAccessibleLocations,
	resolveActiveLocations,
	resolveAllLocations,
	resolveMemberLocationAccess,
} from "@/contexts/tenancy/lib/org/location-access";
import { locationFixture, tenantContextFixture, STORE_A_LOCATION, STORE_B_LOCATION } from "@/test/tenant-context";
import { STORE_B } from "@/test/terminals";

const PENDING_LOCATION = locationFixture({ id: "0f0f0f0f-0000-4000-8000-00000000000c", name: "Cheras" }, "PENDING_APPROVAL");

describe("tenant location access", () => {
	it("lists every location for management views, active ones for operations", () => {
		const context = tenantContextFixture({ locations: [STORE_A_LOCATION, PENDING_LOCATION] });

		expect(resolveAllLocations(context)).toEqual([STORE_A_LOCATION, PENDING_LOCATION]);
		expect(resolveActiveLocations(context)).toEqual([STORE_A_LOCATION]);
	});

	it("gives an all-locations member every active location", () => {
		const context = tenantContextFixture({ locations: [STORE_A_LOCATION, STORE_B_LOCATION, PENDING_LOCATION] });

		expect(resolveAccessibleLocations(context)).toEqual([STORE_A_LOCATION, STORE_B_LOCATION]);
	});

	it("limits a SELECTED-scope member to the active locations in their scope", () => {
		const context = tenantContextFixture({
			locations: [STORE_A_LOCATION, STORE_B_LOCATION, PENDING_LOCATION],
			locationScopeType: "SELECTED",
			locationIds: [STORE_B.id, PENDING_LOCATION.id],
		});

		expect(resolveAccessibleLocations(context)).toEqual([STORE_B_LOCATION]);
	});

	it("records whether the membership covers the whole tenant", () => {
		expect(resolveMemberLocationAccess(tenantContextFixture({ locations: [STORE_A_LOCATION] }))).toEqual({
			locations: [STORE_A_LOCATION],
			hasTenantWideAccess: true,
		});
		expect(
			resolveMemberLocationAccess(tenantContextFixture({ locations: [STORE_A_LOCATION, STORE_B_LOCATION], locationScopeType: "SELECTED", locationIds: [STORE_B.id] })),
		).toEqual({ locations: [STORE_B_LOCATION], hasTenantWideAccess: false });
	});

	it("offers org-wide rollups only to all-locations members with more than one store", () => {
		expect(canSelectAllLocations({ locations: [STORE_A_LOCATION, STORE_B_LOCATION], hasTenantWideAccess: true })).toBe(true);
		expect(canSelectAllLocations({ locations: [STORE_A_LOCATION], hasTenantWideAccess: true })).toBe(false);
		expect(canSelectAllLocations({ locations: [], hasTenantWideAccess: true })).toBe(false);
	});

	it("never offers org-wide rollups to a store-limited member, however many stores they have", () => {
		expect(canSelectAllLocations({ locations: [STORE_A_LOCATION, STORE_B_LOCATION], hasTenantWideAccess: false })).toBe(false);
	});
});
