import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import { MERCHANT_CAPABILITY, type CapabilitySlug } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { filterMerchantNavItems, MERCHANT_NAV_ITEMS, resolvePinnedMerchantNavItems } from "@/lib/navigation/nav-items";
import { buildMerchantPaletteItems } from "@/lib/palette/nav-items";
import { resolveMerchantCapabilities } from "@/lib/session/server-capabilities";
import { ORG_ROUTES } from "@/lib/routes";
import { membershipFixture } from "@/test/authorization";

function predicateFor(capabilities: readonly CapabilitySlug[]): (permission: CapabilitySlug) => boolean {
	const granted = createGrantedCapabilities(capabilities);
	return (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission);
}

describe("merchant nav authorization", () => {
	it("shows every entry to owners", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("OWNER")));

		expect(filterMerchantNavItems(MERCHANT_NAV_ITEMS, can).map((item) => item.id)).toEqual([
			"dashboard",
			"analytics",
			"rewards",
			"rewards-new",
			"redemptions",
			"terminals",
			"api-keys",
			"settings",
			"settings-team",
			"settings-locations",
			"settings-verification",
			"account",
		]);
	});

	it("hides business verification from admins (owner-only)", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("ADMIN")));
		const ids = filterMerchantNavItems(MERCHANT_NAV_ITEMS, can).map((item) => item.id);

		expect(ids).toContain("settings-team");
		expect(ids).toContain("settings-locations");
		expect(ids).not.toContain("settings-verification");
	});

	it("hides create-reward, POS terminals, API keys, team and verification from cashiers", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("CASHIER")));
		const ids = filterMerchantNavItems(MERCHANT_NAV_ITEMS, can).map((item) => item.id);

		expect(ids).toEqual(["dashboard", "analytics", "rewards", "redemptions", "settings", "settings-locations", "account"]);
		expect(buildMerchantPaletteItems(can).map((item) => item.id)).toEqual(ids);
	});

	it("drops pinned entries the role can no longer open", () => {
		const can = predicateFor([MERCHANT_CAPABILITY.viewDashboard]);

		expect(resolvePinnedMerchantNavItems([ORG_ROUTES.apiKeys, ORG_ROUTES.terminals, ORG_ROUTES.dashboard], can).map((item) => item.id)).toEqual(["dashboard"]);
	});

	it("ignores pins saved under retired URLs", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("OWNER")));

		expect(resolvePinnedMerchantNavItems(["/", "/locations", "/settings/kyb"], can)).toEqual([]);
	});

	it("drops a pinned team page once the role loses merchant:manage_team", () => {
		const can = predicateFor(resolveMerchantCapabilities(membershipFixture("MEMBER")));

		expect(resolvePinnedMerchantNavItems([ORG_ROUTES.settings.team, ORG_ROUTES.settings.locations], can).map((item) => item.id)).toEqual(["settings-locations"]);
	});

	it("leaves only the open account entry without a membership", () => {
		expect(filterMerchantNavItems(MERCHANT_NAV_ITEMS, predicateFor(resolveMerchantCapabilities(undefined))).map((item) => item.id)).toEqual(["account"]);
	});
});
