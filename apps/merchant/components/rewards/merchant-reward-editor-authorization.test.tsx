// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantCreateRewardPageView } from "@/components/rewards/merchant-create-reward-page-view";
import { MerchantEditRewardPageView } from "@/components/rewards/merchant-edit-reward-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";

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
			},
		},
	}),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push: vi.fn(), refresh: vi.fn() }),
}));

interface FormFieldsStubProps {
	readonly readOnly?: boolean;
}

vi.mock("@/components/rewards/merchant-reward-form-fields", () => ({
	MerchantRewardFormFields: ({ readOnly = false }: FormFieldsStubProps): React.JSX.Element => <p>{readOnly ? "fields read-only" : "fields editable"}</p>,
}));

vi.mock("@/components/rewards/merchant-reward-location-fields", () => ({
	MerchantRewardLocationFields: (): React.JSX.Element => <p>location fields</p>,
}));

const DRAFT_REWARD = {
	id: REWARD_ID,
	title: "Free latte",
	description: "One free latte",
	rewardType: "FREE_ITEM",
	rewardValue: 12,
	rules: null,
	termsConditions: null,
	startDate: 1_767_225_600_000,
	expiryDate: 1_769_904_000_000,
	quantityTotal: 100,
	quantityRemaining: 80,
	claimCount: 20,
	redemptionCount: 10,
	category: "cafe",
	status: "DRAFT",
};

function renderWithQueryClient(ui: React.ReactElement, role: "OWNER" | "CASHIER" | "MEMBER" | undefined, isLoading = false): void {
	renderWithAuthorization(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>, { role, isLoading });
}

beforeEach((): void => {
	rewardsListQuery.mockReturnValue({ data: { data: [DRAFT_REWARD] }, isLoading: false, isFetching: false, refetch: vi.fn() });
	rewardsMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	rewardsListQuery.mockReset();
	rewardsMutation.mockReset();
});

describe("MerchantCreateRewardPageView authorization", () => {
	it("renders the create form with merchant:manage_rewards", () => {
		renderWithQueryClient(<MerchantCreateRewardPageView orgSlug={TEST_ORG_SLUG} defaultCategory="cafe" />, "OWNER");

		expect(screen.getByRole("heading", { name: "Create Reward" })).toBeTruthy();
		expect(rewardsMutation).toHaveBeenCalled();
	});

	it("renders the access-denied page and never mounts the create mutation without it", () => {
		renderWithQueryClient(<MerchantCreateRewardPageView orgSlug={TEST_ORG_SLUG} defaultCategory="cafe" />, "CASHIER");

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(screen.queryByRole("heading", { name: "Create Reward" })).toBeNull();
		expect(rewardsMutation).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithQueryClient(<MerchantCreateRewardPageView orgSlug={TEST_ORG_SLUG} defaultCategory="cafe" />, undefined, true);

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
	});
});

describe("MerchantEditRewardPageView authorization", () => {
	it("lets managers edit and submit a draft", () => {
		renderWithQueryClient(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "OWNER");

		expect(screen.getByRole("heading", { name: "Edit Reward" })).toBeTruthy();
		expect(screen.getByText("fields editable")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Submit for review" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
	});

	it("shows a read-only view without merchant:manage_rewards", () => {
		renderWithQueryClient(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "CASHIER");

		expect(screen.getByRole("heading", { name: "View Reward" })).toBeTruthy();
		expect(screen.getByText("fields read-only")).toBeTruthy();
		expect(screen.getByRole("note").textContent).toContain("not edit it");
		expect(screen.queryByRole("button", { name: "Submit for review" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
	});

	it("denies the page without merchant:view_rewards", () => {
		renderWithQueryClient(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, "MEMBER");

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(rewardsListQuery).not.toHaveBeenCalled();
	});
});
