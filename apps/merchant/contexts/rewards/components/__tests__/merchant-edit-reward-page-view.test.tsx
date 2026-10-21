// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantEditRewardPageView } from "@/contexts/rewards/components/merchant-edit-reward-page-view";
import { MERCHANT_REWARD_EDITOR_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { busyRegionAnnouncements } from "@/test/skeleton";
import { contextQueryState, TWO_STORE_CONTEXT } from "@/test/tenant-context";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { epochMs, type RewardResponse } from "@workspace/shared";
import { RewardEditorTextFieldSchema, type RewardEditorState } from "@/contexts/rewards/lib/reward-editor-form";
import { rewardFixture } from "@/test/rewards";
import { tenantRoutes } from "@/lib/routes";

const REWARD_ID = "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d";

interface RewardQueryOptions {
	readonly staleTime?: number;
	readonly refetchOnMount?: boolean | "always";
}

interface UpdateMutationOptions {
	readonly onSuccess: (response: { readonly data: RewardResponse }) => void;
}

const { rewardQuery, rewardsMutation, routerPush } = vi.hoisted(() => ({
	rewardQuery: vi.fn<(input: object, options?: RewardQueryOptions) => object>(),
	rewardsMutation: vi.fn<(options: UpdateMutationOptions) => object>(),
	routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): object => ({ push: routerPush, refresh: vi.fn() }),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				rewards: { get: { useQuery: rewardQuery }, update: { useMutation: rewardsMutation } },
				context: { useQuery: (): object => contextQueryState(TWO_STORE_CONTEXT) },
			},
		},
	}),
}));

interface FormFieldsStubProps {
	readonly editor: RewardEditorState;
}

/** Real inputs bound to the editor's state stand in for the full form — the minimum spend held as the real form holds it. */
function FormFieldsStub({ editor }: FormFieldsStubProps): React.JSX.Element {
	const { values, setField } = editor;
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const field = RewardEditorTextFieldSchema.safeParse(event.currentTarget.name);
			if (field.success) {
				setField(field.data, event.currentTarget.value);
			}
		},
		[setField],
	);
	return (
		<>
			<input aria-label="Title" name="title" value={values.title} onChange={handleChange} />
			<input aria-label="Description" name="description" value={values.description} onChange={handleChange} />
			<input aria-label="Minimum purchase" type="number" name="minPurchase" value={values.minPurchase} onChange={handleChange} />
		</>
	);
}

vi.mock("@/contexts/rewards/components/merchant-reward-form-fields", () => ({ MerchantRewardFormFields: FormFieldsStub }));

function draftReward(description: string, status: RewardResponse["status"] = "DRAFT"): RewardResponse {
	return rewardFixture({
		id: REWARD_ID,
		title: "Free latte",
		description,
		rewardValue: 12,
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

function rewardReturns(description: string, status: RewardResponse["status"] = "DRAFT"): void {
	rewardQuery.mockReturnValue({ data: { data: draftReward(description, status) }, isSuccess: true, isError: false, error: null, refetch: vi.fn() });
}

beforeEach((): void => {
	rewardReturns("One free latte");
	rewardsMutation.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
});

describe("MerchantEditRewardPageView form", () => {
	it("fills the form from the reward, and a refetch keeps unsaved edits while updating untouched fields", () => {
		const view = renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });
		expect(screen.getByLabelText("Title")).toHaveProperty("value", "Free latte");

		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Two free lattes" } });
		rewardReturns("Updated elsewhere");
		view.rerender(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />);

		expect(screen.getByLabelText("Title")).toHaveProperty("value", "Two free lattes");
		expect(screen.getByLabelText("Description")).toHaveProperty("value", "Updated elsewhere");
	});

	it("opens a reward with a saved minimum spend, showing that amount", () => {
		rewardQuery.mockReturnValue({
			data: { data: rewardFixture({ ...draftReward("One free latte"), rules: { minSpendMyr: 30 } }) },
			isSuccess: true,
			isLoading: false,
			isFetching: false,
			isError: false,
			error: null,
			refetch: vi.fn(),
		});
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		expect(screen.getByLabelText("Minimum purchase")).toHaveProperty("value", "30");
	});

	it("uses the cache instead of refetching on every mount", () => {
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		const [, options] = rewardQuery.mock.calls.at(0) ?? [];
		expect(options).not.toHaveProperty("refetchOnMount");
		expect(options).toHaveProperty("staleTime", expect.any(Number));
		expect(options?.staleTime).toBeGreaterThan(0);
	});

	it("draws the editor's shape — not 'reward not found' — while the reward resolves", () => {
		rewardQuery.mockReturnValue({ data: undefined, isSuccess: false, isError: false, error: null, refetch: vi.fn() });
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REWARD_EDITOR_LOADING_LABELS.loading]);
		expect(document.querySelector('[data-slot="reward-preview-skeleton"]')).not.toBeNull();
		expect(screen.queryByText("Reward not found")).toBeNull();
		expect(screen.queryByLabelText("Title")).toBeNull();
	});

	it("shows a load failure as an error with a retry — not as 'reward not found'", () => {
		const refetch = vi.fn();
		rewardQuery.mockReturnValue({
			data: undefined,
			isLoading: false,
			isFetching: false,
			isError: true,
			error: new ApiError({ message: "upstream timeout", statusCode: 504 }),
			refetch,
		});
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		expect(screen.getByText("Could not load this reward")).toBeTruthy();
		expect(screen.queryByText("upstream timeout")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});

	it("draws the live preview beside the form, with the reward's own voucher", () => {
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		const preview = document.querySelector('[data-slot="reward-preview"]');
		expect(preview?.querySelector('[data-slot="reward-voucher"]')).not.toBeNull();
		expect(preview?.textContent).toContain("Free latte");
	});

	it("returns to the reward page once the changes are saved", () => {
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });
		const [options] = rewardsMutation.mock.calls.at(0) ?? [];

		act((): void => {
			options?.onSuccess({ data: draftReward("One free latte") });
		});

		expect(routerPush).toHaveBeenCalledWith(tenantRoutes(TEST_ORG_SLUG).rewards.detail(REWARD_ID), { scroll: false });
	});

	it("explains that a live reward can't be edited, and links back to it instead of showing the form", () => {
		rewardReturns("One free latte", "PUBLISHED");
		renderWithAuthorization(<MerchantEditRewardPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });

		expect(screen.getByRole("heading", { name: "This reward can't be edited" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "View reward" }).getAttribute("href")).toBe(tenantRoutes(TEST_ORG_SLUG).rewards.detail(REWARD_ID));
		expect(screen.queryByLabelText("Title")).toBeNull();
	});
});
