// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardsPageView } from "@/components/rewards/merchant-rewards-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A } from "@/test/terminals";
import type { apiRouter } from "@workspace/client/lib/api/endpoints";
import { ApiError } from "@workspace/client/lib/api/use-api";

type RewardsListInput = Parameters<typeof apiRouter.organizations.rewards.list.queryKey>[0];

interface RewardsListOptions {
	readonly enabled?: boolean;
	readonly staleTime?: number;
	readonly gcTime?: number;
}

const { rewardsListQuery, contextQuery } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn<(input: RewardsListInput, options?: RewardsListOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { rewards: { list: { useQuery: rewardsListQuery } }, context: { useQuery: contextQuery } } },
	}),
}));

beforeEach((): void => {
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
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
	contextQuery.mockReset();
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

describe("MerchantRewardsPageView store filter", () => {
	it("queries the chosen store on the first render once the server seeded the organization context", () => {
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) });

		const [input, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(input).toEqual({ orgSlug: TEST_ORG_SLUG, locationId: STORE_A.id });
		expect(options?.enabled).toBe(true);
	});

	it("waits for the accessible locations before querying when they are still loading", () => {
		contextQuery.mockReturnValue(contextQueryState(undefined));
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: { initialLocationId: STORE_A.id } });

		const [, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(options?.enabled).toBe(false);
	});
});

describe("MerchantRewardsPageView caching and errors", () => {
	it("keeps the catalog cached between navigations instead of bypassing the cache", () => {
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) });

		const [, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(options?.staleTime).toBeGreaterThan(0);
		expect(options?.gcTime).toBeUndefined();
	});

	it("shows a user-safe message, never the raw transport error", () => {
		const rawMessage = "Request failed: GET http://api.internal/orgs/acme/rewards ECONNRESET";
		rewardsListQuery.mockReturnValue({
			isSuccess: false,
			isPending: false,
			isFetching: false,
			isError: true,
			error: new ApiError({ message: rawMessage, statusCode: 502 }),
			data: undefined,
			refetch: vi.fn(),
		});
		renderWithAuthorization(<MerchantRewardsPageView orgSlug={TEST_ORG_SLUG} />, { role: "OWNER", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(screen.getByText("Could not load rewards")).toBeTruthy();
		expect(screen.queryByText(rawMessage)).toBeNull();
	});
});
