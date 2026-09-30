// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardsPageView } from "@/components/rewards/merchant-rewards-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

const { rewardsListQuery } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { rewards: { list: { useQuery: rewardsListQuery } } } },
	}),
}));

beforeEach((): void => {
	rewardsListQuery.mockReturnValue({
		isSuccess: true,
		isPending: false,
		isFetching: false,
		isError: false,
		error: null,
		data: { data: [] },
		refetch: vi.fn(),
	});
});

afterEach((): void => {
	cleanup();
	rewardsListQuery.mockReset();
});

describe("MerchantRewardsPageView authorization", () => {
	it("shows create actions to roles with merchant:manage_rewards", () => {
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER" });

		expect(screen.getByRole("link", { name: "New reward" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Create first reward" })).toBeTruthy();
		expect(screen.queryByRole("note")).toBeNull();
	});

	it("hides create actions and shows a read-only notice for view-only roles", () => {
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "CASHIER" });

		expect(screen.queryByRole("link", { name: "New reward" })).toBeNull();
		expect(screen.queryByRole("link", { name: "Create first reward" })).toBeNull();
		expect(screen.getByRole("note").textContent).toContain("view rewards but not create");
	});

	it("denies the page (and skips the list query) without merchant:view_rewards", () => {
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(rewardsListQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state rather than a denial while the membership resolves", () => {
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
		expect(screen.queryByText("You don't have access to this page")).toBeNull();
		expect(rewardsListQuery).not.toHaveBeenCalled();
	});
});
