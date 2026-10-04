// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import type { UseFormRegister } from "react-hook-form";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantEditRewardPageView } from "@/components/rewards/merchant-edit-reward-page-view";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, TWO_STORE_CONTEXT } from "@/test/tenant-context";
import { ApiError } from "@workspace/client/lib/api/use-api";
import type { MerchantRewardFormValues } from "@workspace/shared";

const REWARD_ID = "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d";

interface RewardsListOptions {
	readonly staleTime?: number;
	readonly refetchOnMount?: boolean | "always";
}

const { rewardsListQuery, rewardsMutation } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn<(input: object, options?: RewardsListOptions) => object>(),
	rewardsMutation: vi.fn(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: {
			organizations: {
				rewards: { list: { useQuery: rewardsListQuery }, update: { useMutation: rewardsMutation }, publish: { useMutation: rewardsMutation } },
				context: { useQuery: (): object => contextQueryState(TWO_STORE_CONTEXT) },
			},
		},
	}),
}));

interface FormFieldsStubProps {
	readonly register: UseFormRegister<MerchantRewardFormValues>;
}

// Two real, registered inputs stand in for the full form.
vi.mock("@/components/rewards/merchant-reward-form-fields", () => ({
	MerchantRewardFormFields: ({ register }: FormFieldsStubProps): React.JSX.Element => (
		<>
			<input aria-label="Title" {...register("title")} />
			<input aria-label="Description" {...register("description")} />
		</>
	),
}));

function draftReward(description: string): object {
	return {
		id: REWARD_ID,
		title: "Free latte",
		description,
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
}

function listReturns(description: string): void {
	rewardsListQuery.mockReturnValue({ data: { data: [draftReward(description)] }, isLoading: false, isFetching: false, isError: false, error: null, refetch: vi.fn() });
}

beforeEach((): void => {
	listReturns("One free latte");
	rewardsMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantEditRewardPageView form", () => {
	it("fills the form from the reward, and a refetch keeps unsaved edits while updating untouched fields", () => {
		const view = renderWithAuthorization(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });
		expect(screen.getByLabelText("Title")).toHaveProperty("value", "Free latte");

		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Two free lattes" } });
		listReturns("Updated elsewhere");
		view.rerender(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />);

		expect(screen.getByLabelText("Title")).toHaveProperty("value", "Two free lattes");
		expect(screen.getByLabelText("Description")).toHaveProperty("value", "Updated elsewhere");
	});

	it("uses the cache instead of refetching on every mount", () => {
		renderWithAuthorization(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		const [, options] = rewardsListQuery.mock.calls.at(0) ?? [];
		expect(options).not.toHaveProperty("refetchOnMount");
		expect(options).toHaveProperty("staleTime", expect.any(Number));
		expect(options?.staleTime).toBeGreaterThan(0);
	});

	it("shows a load failure as an error with a retry — not as 'reward not found'", () => {
		const refetch = vi.fn();
		rewardsListQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isFetching: false,
			isError: true,
			error: new ApiError({ message: "upstream timeout", statusCode: 504 }),
			refetch,
		});
		renderWithAuthorization(<MerchantEditRewardPageView orgSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		expect(screen.getByText("Could not load this reward")).toBeTruthy();
		expect(screen.queryByText("upstream timeout")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});
});
