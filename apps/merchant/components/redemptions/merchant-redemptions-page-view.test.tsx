// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRedemptionsPageView } from "@/components/redemptions/merchant-redemptions-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const { redemptionsQuery } = vi.hoisted(() => ({
	redemptionsQuery: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { redemptions: { useQuery: redemptionsQuery } } },
	}),
}));

beforeEach((): void => {
	redemptionsQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
});

afterEach((): void => {
	cleanup();
	redemptionsQuery.mockReset();
});

describe("MerchantRedemptionsPageView authorization", () => {
	it("renders the redemption log with merchant:view_redemptions", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.getByText("No redemptions yet")).toBeTruthy();
	});

	it("denies the page and skips the redemptions query without the capability", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} />, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(redemptionsQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
	});
});
