import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import { MERCHANT_CAPABILITY, type CapabilitySlug } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { filterMerchantNavItems, MERCHANT_NAV_ITEMS, resolvePinnedMerchantNavItems } from "@/lib/navigation/nav-items";
import { buildMerchantPaletteItems } from "@/lib/palette/nav-items";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { membershipFixture } from "@/test/authorization";

function predicateFor(capabilities: readonly CapabilitySlug[]): (permission: CapabilitySlug) => boolean {
	const granted = createGrantedCapabilities(capabilities);
	return (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission);
}

describe("merchant nav authorization", () => {
	it("shows every entry to owners", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("OWNER")));

		expect(filterMerchantNavItems(MERCHANT_NAV_ITEMS, can).map((item) => item.id)).toEqual(["dashboard", "analytics", "rewards", "rewards-new", "redemptions", "api-keys"]);
	});

	it("hides create-reward and API keys from cashiers", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("CASHIER")));
		const ids = filterMerchantNavItems(MERCHANT_NAV_ITEMS, can).map((item) => item.id);

		expect(ids).toEqual(["dashboard", "analytics", "rewards", "redemptions"]);
		expect(buildMerchantPaletteItems(can).map((item) => item.id)).toEqual(ids);
	});

	it("drops pinned entries the role can no longer open", () => {
		const can = predicateFor([MERCHANT_CAPABILITY.viewDashboard]);

		expect(resolvePinnedMerchantNavItems(["/api-keys", "/"], can).map((item) => item.id)).toEqual(["dashboard"]);
	});

	it("denies everything without a membership", () => {
		expect(filterMerchantNavItems(MERCHANT_NAV_ITEMS, predicateFor(resolveMerchantCapabilities(undefined)))).toEqual([]);
	});
});
