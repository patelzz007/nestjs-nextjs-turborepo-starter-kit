import { describe, expect, it, vi } from "vitest";

import { merchantProfileMenuItems, type MerchantProfileMenuAccess, type MerchantProfileMenuPaths } from "@/components/layout/merchant-profile-menu";

const PATHS: MerchantProfileMenuPaths = { account: "/o/acme/account", dashboard: "/o/acme", apiKeys: "/o/acme/api-keys", settings: "/o/acme/settings" };
const FULL_ACCESS: MerchantProfileMenuAccess = { isEnrollmentLocked: false, canViewDashboard: true, canManageApiKeys: true };

function labelsOf(access: MerchantProfileMenuAccess): readonly string[] {
	return merchantProfileMenuItems(access, PATHS, vi.fn()).map((item) => item.label);
}

describe("merchantProfileMenuItems", () => {
	it("offers the account, the dashboard, API keys and the organization settings to a member with every capability", () => {
		expect(labelsOf(FULL_ACCESS)).toStrictEqual(["Account", "Dashboard", "API keys", "Organization settings"]);
	});

	it("offers only the personal account while enrollment is locked", () => {
		expect(labelsOf({ ...FULL_ACCESS, isEnrollmentLocked: true })).toStrictEqual(["Account"]);
	});

	it("leaves out the pages the member's capabilities do not allow", () => {
		expect(labelsOf({ ...FULL_ACCESS, canViewDashboard: false, canManageApiKeys: false })).toStrictEqual(["Account", "Organization settings"]);
	});

	it("takes each item to its organization-scoped page", () => {
		const navigate = vi.fn();
		merchantProfileMenuItems(FULL_ACCESS, PATHS, navigate).forEach((item) => {
			item.onClick();
		});
		expect(navigate.mock.calls).toStrictEqual([[PATHS.account], [PATHS.dashboard], [PATHS.apiKeys], [PATHS.settings]]);
	});
});
