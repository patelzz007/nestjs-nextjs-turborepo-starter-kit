import { afterEach, describe, expect, it, vi } from "vitest";

import { ROUTES, tenantRoutes } from "@/lib/routes";

import MerchantNotificationsEntryPage from "../page";

const { resolveMerchantEntryTenantSlug, redirect } = vi.hoisted(() => ({
	resolveMerchantEntryTenantSlug: vi.fn<() => Promise<string | undefined>>(),
	// Like Next's `redirect()`, the mock throws: nothing after the call runs.
	redirect: vi.fn((url: string): void => {
		throw new Error(`NEXT_REDIRECT ${url}`);
	}),
}));

vi.mock("@/lib/merchant-server-api", () => ({ resolveMerchantEntryTenantSlug }));
vi.mock("next/navigation", () => ({ redirect }));

afterEach((): void => {
	resolveMerchantEntryTenantSlug.mockReset();
	redirect.mockClear();
});

describe("/notifications (merchant inbox entry)", () => {
	it("opens the inbox inside the member's tenant", async () => {
		resolveMerchantEntryTenantSlug.mockResolvedValue("sunrise-cafe");

		await expect(MerchantNotificationsEntryPage()).rejects.toThrow(`NEXT_REDIRECT ${tenantRoutes("sunrise-cafe").notifications}`);
		expect(redirect).toHaveBeenCalledWith(tenantRoutes("sunrise-cafe").notifications);
	});

	it("sends a person with no tenant to onboarding", async () => {
		resolveMerchantEntryTenantSlug.mockResolvedValue(undefined);

		await expect(MerchantNotificationsEntryPage()).rejects.toThrow(`NEXT_REDIRECT ${ROUTES.onboarding}`);
		expect(redirect).toHaveBeenCalledWith(ROUTES.onboarding);
	});
});
