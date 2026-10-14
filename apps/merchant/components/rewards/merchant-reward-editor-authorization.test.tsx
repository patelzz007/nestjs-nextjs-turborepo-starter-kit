// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantCreateRewardPageView } from "@/components/rewards/merchant-create-reward-page-view";
import { MerchantEditRewardPageView } from "@/components/rewards/merchant-edit-reward-page-view";
import { MerchantRewardDetailPageView } from "@/components/rewards/merchant-reward-detail-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, TWO_STORE_CONTEXT } from "@/test/tenant-context";
import { MERCHANT_REWARD_EDITOR_LOADING_LABELS, MERCHANT_REWARD_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";
import { rewardFixture } from "@/test/rewards";
import { orgRoutes } from "@/lib/routes";
import { epochMs, type OrganizationMembershipRole, type RewardResponse } from "@workspace/shared";

const REWARD_ID = "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d";

const { rewardsListQuery, rewardsMutation } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn(),
	rewardsMutation: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			organizations: {
				rewards: {
					list: { useQuery: rewardsListQuery },
					create: { useMutation: rewardsMutation },
					update: { useMutation: rewardsMutation },
					publish: { useMutation: rewardsMutation },
				},
				context: { useQuery: (): object => contextQueryState(TWO_STORE_CONTEXT) },
			},
		},
	}),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/rewards/merchant-reward-form-fields", () => ({
	MerchantRewardFormFields: (): React.JSX.Element => <p>reward fields</p>,
}));

/** jsdom has no ResizeObserver; the reward page's gallery observes its size. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

function rewardWithStatus(status: RewardResponse["status"]): RewardResponse {
	return rewardFixture({
		id: REWARD_ID,
		title: "Free latte",
		description: "One free latte",
		rewardValue: 1,
		startDate: epochMs(1_767_225_600_000),
		expiryDate: epochMs(1_769_904_000_000),
		quantityTotal: 100,
		quantityRemaining: 80,
		claimCount: 20,
		redemptionCount: 10,
		category: "cafe",
		status,
	});
}

function listReturns(reward: RewardResponse): void {
	rewardsListQuery.mockReturnValue({ data: { data: [reward] }, isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn() });
}

function renderWithQueryClient(ui: React.ReactElement, role: OrganizationMembershipRole | undefined, isLoading = false): void {
	renderWithAuthorization(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>, { role, isLoading });
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	listReturns(rewardWithStatus("DRAFT"));
	rewardsMutation.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	rewardsListQuery.mockReset();
	rewardsMutation.mockReset();
	vi.unstubAllGlobals();
});

describe("MerchantCreateRewardPageView authorization", () => {
	it("renders the editor with merchant:manage_rewards, offering a private draft and a review submission", () => {
		renderWithQueryClient(<MerchantCreateRewardPageView orgSlug={TEST_ORG_SLUG} defaultCategory="cafe" />, "OWNER");

		expect(screen.getByRole("heading", { name: "New reward" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Save as draft" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy();
		expect(rewardsMutation).toHaveBeenCalled();
	});

	it("renders the access-denied page and never mounts the create mutation without it", () => {
		renderWithQueryClient(<MerchantCreateRewardPageView orgSlug={TEST_ORG_SLUG} defaultCategory="cafe" />, "CASHIER");

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "New reward" })).toBeNull();
		expect(rewardsMutation).not.toHaveBeenCalled();
	});

	it("renders the editor's skeleton while the membership resolves", () => {
		renderWithQueryClient(<MerchantCreateRewardPageView orgSlug={TEST_ORG_SLUG} defaultCategory="cafe" />, undefined, true);

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REWARD_EDITOR_LOADING_LABELS.loading]);
	});
});

describe("MerchantEditRewardPageView authorization", () => {
	it("lets managers edit a draft", () => {
		renderWithQueryClient(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "OWNER");

		expect(screen.getByRole("heading", { name: "Edit reward" })).toBeTruthy();
		expect(screen.getByText("reward fields")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
	});

	it("denies the editor without merchant:manage_rewards — viewing a reward is its own page", () => {
		renderWithQueryClient(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "CASHIER");

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(screen.queryByText("reward fields")).toBeNull();
		expect(rewardsMutation).not.toHaveBeenCalled();
	});
});

describe("MerchantRewardDetailPageView authorization", () => {
	it("offers a manager the draft's review submission and its editor", () => {
		renderWithQueryClient(<MerchantRewardDetailPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "OWNER");

		expect(screen.getByRole("heading", { level: 1, name: "Free latte" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Edit reward" }).getAttribute("href")).toBe(orgRoutes(TEST_ORG_SLUG).rewards.edit(REWARD_ID));
	});

	it("keeps a reward in review editable but not submittable again", () => {
		listReturns(rewardWithStatus("PENDING_REVIEW"));
		renderWithQueryClient(<MerchantRewardDetailPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "OWNER");

		expect(screen.getByRole("link", { name: "Edit reward" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
	});

	it("offers no edit or submission for a live reward", () => {
		listReturns(rewardWithStatus("PUBLISHED"));
		renderWithQueryClient(<MerchantRewardDetailPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "OWNER");

		expect(screen.queryByRole("link", { name: "Edit reward" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
	});

	it("shows the reward without its actions to a role that can only view rewards", () => {
		renderWithQueryClient(<MerchantRewardDetailPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "CASHIER");

		expect(screen.getByRole("heading", { level: 1, name: "Free latte" })).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Edit reward" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
	});

	it("denies the page without merchant:view_rewards", () => {
		renderWithQueryClient(<MerchantRewardDetailPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "MEMBER");

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(rewardsListQuery).not.toHaveBeenCalled();
	});

	it("renders the reward page's skeleton while the membership resolves", () => {
		renderWithQueryClient(<MerchantRewardDetailPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, undefined, true);

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REWARD_LOADING_LABELS.loading]);
	});
});
