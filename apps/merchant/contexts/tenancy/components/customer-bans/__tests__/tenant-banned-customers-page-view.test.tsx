// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import {
	ApiPaginatedMetaSchema,
	epochMs,
	PLATFORM_DISPLAY_REGION,
	TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT,
	TenantCustomerBanResponseSchema,
	type ApiPaginatedMeta,
	type TenantCustomerBanResponse,
} from "@workspace/shared";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { banSourceLabel, TenantBannedCustomersPageView } from "@/contexts/tenancy/components/customer-bans/tenant-banned-customers-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { testEnvelope } from "@/test/envelope";

const REDEEMED_AT = epochMs(1_792_368_000_000);

const { bansQuery, liftBan } = vi.hoisted(() => ({
	bansQuery: vi.fn<(input: object) => object>(),
	liftBan: vi.fn<(input: object) => void>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				customerBans: { useQuery: bansQuery },
				liftCustomerBan: { useMutation: (): object => ({ mutate: liftBan, isPending: false }) },
			},
		},
	}),
}));

const BAN: TenantCustomerBanResponse = TenantCustomerBanResponseSchema.parse({
	id: "0199a1b2-0000-7000-8000-0000000000b1",
	reason: "Showed a screenshot of a used voucher",
	bannedAt: REDEEMED_AT,
	bannedBy: { id: "0199a1b2-0000-7000-8000-0000000000c1", fullName: "Mia Owner" },
	source: { redemptionId: "0199a1b2-0000-7000-8000-0000000000d1", rewardTitle: "Free latte", redeemedAt: REDEEMED_AT },
});

/** One page holding every ban shown. */
function onePage(count: number): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "",
		timestamp: REDEEMED_AT,
		limit: TENANT_CUSTOMER_BAN_LIST_DEFAULT_LIMIT,
		total: count,
		page: 1,
		totalPages: 1,
		nextCursor: null,
		hasNext: false,
		hasPrevious: false,
	});
}

beforeEach((): void => {
	window.history.replaceState(null, "", `/t/${TEST_ORG_SLUG}/settings/banned-customers`);
	bansQuery.mockReturnValue({ data: testEnvelope([BAN], onePage(1)), isLoading: false, isError: false, error: null });
});

afterEach((): void => {
	cleanup();
	bansQuery.mockReset();
	liftBan.mockReset();
	window.history.replaceState(null, "", "/");
});

describe("TenantBannedCustomersPageView", () => {
	it("lists each ban by the redemption it was made from, with the reason and who made it, and lifts it", () => {
		renderWithAuthorization(<TenantBannedCustomersPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByText(banSourceLabel(BAN))).toBeTruthy();
		expect(screen.getByText("Showed a screenshot of a used voucher")).toBeTruthy();
		expect(screen.getByText(/by Mia Owner/)).toBeTruthy();
		expect(bansQuery).toHaveBeenCalledWith(expect.objectContaining({ tenantSlug: TEST_ORG_SLUG, page: 1 }));

		fireEvent.click(screen.getByRole("button", { name: "Lift ban" }));

		expect(liftBan).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, banId: BAN.id });
	});

	it("says so when nobody is banned", () => {
		bansQuery.mockReturnValue({ data: testEnvelope([], onePage(0)), isLoading: false, isError: false, error: null });
		renderWithAuthorization(<TenantBannedCustomersPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByText("No banned customers")).toBeTruthy();
	});

	it("denies a cashier, who cannot manage rewards, without querying the bans", () => {
		renderWithAuthorization(<TenantBannedCustomersPageView tenantSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(bansQuery).not.toHaveBeenCalled();
	});
});

describe("banSourceLabel", () => {
	it("names the reward and the time of the redemption, never the customer", () => {
		expect(banSourceLabel(BAN)).toBe(`Customer who redeemed Free latte on ${formatEpochMs(REDEEMED_AT, "dateTime", PLATFORM_DISPLAY_REGION)}`);
		expect(banSourceLabel({ ...BAN, source: null })).toBe("Customer from a redemption that no longer exists");
	});
});
