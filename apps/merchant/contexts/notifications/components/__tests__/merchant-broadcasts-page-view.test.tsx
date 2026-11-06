// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { epochMs } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BroadcastAllowanceNotice, describeBroadcastWhen, MerchantBroadcastsPageView } from "@/contexts/notifications/components/merchant-broadcasts-page-view";
import { tenantRoutes } from "@/lib/routes";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/testing/authorization";
import { broadcastFixture } from "@/testing/broadcasts";

const { broadcastsQuery, allowanceQuery } = vi.hoisted(() => ({ broadcastsQuery: vi.fn(), allowanceQuery: vi.fn() }));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenantNotifications: { broadcasts: { useQuery: broadcastsQuery }, broadcastAllowance: { useQuery: allowanceQuery } } } }),
}));

const META = { correlationId: "c", timestamp: 0, limit: 20, total: 1, page: 1, totalPages: 1, nextCursor: null, hasNext: false, hasPrevious: false };

beforeEach((): void => {
	window.history.replaceState(null, "", `/t/${TEST_ORG_SLUG}/broadcasts`);
	allowanceQuery.mockReturnValue({ data: { data: { used: 2, limit: 5, broadcastingEnabled: true } } });
	broadcastsQuery.mockReturnValue({
		data: { data: [broadcastFixture({ status: "SENT", completedAt: epochMs(Date.UTC(2026, 9, 31, 2, 0)), audienceCount: 42 })], meta: META },
		isPlaceholderData: false,
	});
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantBroadcastsPageView", () => {
	it("lists each broadcast with its state and links to it", () => {
		renderWithAuthorization(<MerchantBroadcastsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		const link = screen.getByRole("link", { name: /Weekend specials/u });
		expect(link.getAttribute("href")).toBe(tenantRoutes(TEST_ORG_SLUG).broadcasts.detail(broadcastFixture().id));
		expect(screen.getByText("Sent", { selector: "[data-slot=badge]" })).toBeTruthy();
		expect(screen.getByText(/42 customers/u)).toBeTruthy();
	});

	it("shows this week's allowance and offers a new broadcast", () => {
		renderWithAuthorization(<MerchantBroadcastsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(document.querySelector("[data-slot=broadcast-allowance]")?.textContent).toBe("2 of 5 broadcasts sent this week. 3 left.");
		expect(screen.getByRole("link", { name: "New broadcast" }).getAttribute("aria-disabled")).toBe("false");
	});

	it("invites the first broadcast when there are none", () => {
		broadcastsQuery.mockReturnValue({ data: { data: [], meta: { ...META, total: 0 } }, isPlaceholderData: false });
		renderWithAuthorization(<MerchantBroadcastsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByText("No broadcasts yet")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Write your first broadcast" })).toBeTruthy();
	});

	it("blocks a new broadcast once the week's limit is used", () => {
		allowanceQuery.mockReturnValue({ data: { data: { used: 5, limit: 5, broadcastingEnabled: true } } });
		renderWithAuthorization(<MerchantBroadcastsPageView tenantSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByRole("link", { name: "New broadcast" }).getAttribute("aria-disabled")).toBe("true");
	});
});

describe("BroadcastAllowanceNotice", () => {
	it("says when broadcasting was switched off", () => {
		renderWithAuthorization(<BroadcastAllowanceNotice allowance={{ used: 0, limit: 5, broadcastingEnabled: false }} />, { role: "OWNER" });

		expect(screen.getByText("Broadcasting is switched off for your store")).toBeTruthy();
	});
});

describe("describeBroadcastWhen", () => {
	it("says when it went or goes out", () => {
		expect(describeBroadcastWhen(broadcastFixture({ sendMode: "RECIPIENT_LOCAL_TIME", localSendAt: epochMs(Date.UTC(2026, 10, 3, 9, 0)) }))).toBe(
			"3 Nov 2026, 09:00 in each customer's own time",
		);
		expect(describeBroadcastWhen(broadcastFixture())).toMatch(/^Written /u);
	});
});
