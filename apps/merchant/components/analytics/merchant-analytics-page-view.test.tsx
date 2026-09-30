// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantAnalyticsPageView } from "@/components/analytics/merchant-analytics-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const { analyticsQuery } = vi.hoisted(() => ({
	analyticsQuery: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { analytics: { useQuery: analyticsQuery } } },
	}),
}));

beforeEach((): void => {
	analyticsQuery.mockReturnValue({ data: undefined, isLoading: true });
});

afterEach((): void => {
	cleanup();
	analyticsQuery.mockReset();
});

describe("MerchantAnalyticsPageView authorization", () => {
	it("renders analytics with merchant:view_analytics", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByRole("heading", { name: "Analytics" })).toBeTruthy();
		expect(analyticsQuery).toHaveBeenCalled();
	});

	it("denies the page and skips the analytics query without the capability", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(analyticsQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantAnalyticsPageView orgSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(analyticsQuery).not.toHaveBeenCalled();
	});
});
