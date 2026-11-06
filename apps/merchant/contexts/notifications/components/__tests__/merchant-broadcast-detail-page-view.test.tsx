// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeBroadcastAudience, MerchantBroadcastDetailPageView } from "@/contexts/notifications/components/merchant-broadcast-detail-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/testing/authorization";
import { broadcastFixture } from "@/testing/broadcasts";
import type { BroadcastResponse } from "@workspace/shared";

const { broadcastQuery, scheduleMutate, cancelMutate } = vi.hoisted(() => ({ broadcastQuery: vi.fn(), scheduleMutate: vi.fn(), cancelMutate: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenantNotifications: {
				broadcast: { useQuery: broadcastQuery },
				scheduleBroadcast: { useMutation: (): object => ({ mutate: scheduleMutate, isPending: false }) },
				cancelBroadcast: { useMutation: (): object => ({ mutate: cancelMutate, isPending: false }) },
			},
		},
	}),
}));

function broadcastReturns(broadcast: BroadcastResponse): void {
	broadcastQuery.mockReturnValue({ data: { data: broadcast }, isError: false, error: null });
}

function renderPage(): void {
	renderWithAuthorization(<MerchantBroadcastDetailPageView tenantSlug={TEST_ORG_SLUG} broadcastId={broadcastFixture().id} />, { role: "OWNER" });
}

beforeEach((): void => {
	broadcastReturns(broadcastFixture());
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantBroadcastDetailPageView", () => {
	it("shows the message, who it is for and how it goes", () => {
		renderPage();
		const details = within(screen.getByRole("region", { name: "Details" }));

		expect(screen.getByRole("heading", { level: 1, name: "Weekend specials" })).toBeTruthy();
		expect(screen.getByText("Half price lattes on Saturday.")).toBeTruthy();
		expect(details.getByText("Customers who claimed in the last 60 days")).toBeTruthy();
		expect(details.getByText("In the app, Email")).toBeTruthy();
	});

	it("lets an owner send a draft from its page", () => {
		renderPage();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Send" }));
		});

		expect(scheduleMutate).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, broadcastId: broadcastFixture().id });
		expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();
	});

	it("stops a scheduled broadcast", () => {
		broadcastReturns(broadcastFixture({ status: "SCHEDULED" }));
		renderPage();
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Cancel broadcast" }));
		});

		expect(cancelMutate).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, broadcastId: broadcastFixture().id });
		expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
	});

	it("explains a pause and lists the results per channel", () => {
		broadcastReturns(
			broadcastFixture({
				status: "PAUSED",
				pauseReason: "Reported by 12 customers",
				results: [{ channel: "EMAIL", targeted: 40, delivered: 35, failed: 2, suppressed: [{ reason: "no-consent", count: 3 }], engaged: null }],
			}),
		);
		renderPage();

		expect(screen.getByText("Reported by 12 customers")).toBeTruthy();
		expect(screen.getByText(/35 delivered · 2 failed · 3 held back/u)).toBeTruthy();
		expect(within(screen.getByRole("table")).getByRole("cell", { name: "Email" })).toBeTruthy();
	});
});

describe("describeBroadcastAudience", () => {
	it("names a picked group or the filters", () => {
		expect(
			describeBroadcastAudience(
				broadcastFixture({ audience: { kind: "tenant-customers", claimedWithinDays: 30, redeemed: "not-redeemed", locationId: null, customerIds: ["a", "b"] } }),
			),
		).toBe("2 customers you picked");
		expect(
			describeBroadcastAudience(
				broadcastFixture({ audience: { kind: "tenant-customers", claimedWithinDays: 30, redeemed: "redeemed", locationId: null, customerIds: null } }),
			),
		).toBe("Customers who claimed in the last 30 days, who redeemed");
	});
});
