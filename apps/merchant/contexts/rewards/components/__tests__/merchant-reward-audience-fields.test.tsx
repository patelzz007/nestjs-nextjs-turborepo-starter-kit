// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type RewardCustomer } from "@workspace/shared";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardAudienceFields } from "@/contexts/rewards/components/merchant-reward-audience-fields";
import { useRewardEditorForm, type RewardEditorInput } from "@/contexts/rewards/lib/reward-editor-form";

interface CustomersQueryState {
	readonly data: { readonly data: readonly RewardCustomer[] } | undefined;
	readonly isPending: boolean;
	readonly isError: boolean;
}

const { customersQuery, tiersState } = vi.hoisted(() => ({
	customersQuery: vi.fn<(input: object) => CustomersQueryState>(),
	tiersState: { enabled: false },
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: { rewards: { customers: { useQuery: customersQuery } } },
			tiers: { availability: { useQuery: (): object => ({ data: { data: tiersState.enabled ? { enabled: true, viewerTier: "BRONZE" } : { enabled: false } } }) } },
		},
	}),
}));

const ALICE: RewardCustomer = {
	userId: "0193f2c4-0000-7000-8000-0000000000a1",
	fullName: "Alice Johnson",
	maskedEmail: "a•••@example.com",
	lastClaimedAt: epochMs(Date.UTC(2026, 9, 1)),
	claimCount: 2,
	tier: null,
};

const DEFAULTS: RewardEditorInput = {
	rewardType: "DISCOUNT",
	title: "",
	description: "",
	imageFileIds: [],
	rewardValue: "0",
	freeItemName: "",
	freeItemSku: "",
	minPurchase: "",
	termsConditions: "",
	startDate: "2026-11-01",
	expiryDate: "2026-11-30",
	quantityTotal: "100",
	maxClaimsPerUser: 1,
	audienceType: "EVERYONE",
	audienceCustomerIds: [],
	minimumTier: "BRONZE",
};

function ignoreSave(): void {
	return undefined;
}

function Harness(): React.JSX.Element {
	const { editor } = useRewardEditorForm<null>({ defaultValues: DEFAULTS, defaultMeta: null, onValid: ignoreSave });
	return (
		<>
			<MerchantRewardAudienceFields editor={editor} tenantSlug="sunrise-cafe" initialCustomers={[]} />
			<output aria-label="Audience">{`${editor.values.audienceType}:${editor.values.audienceCustomerIds.join(",")}`}</output>
			<output aria-label="Minimum tier">{editor.values.minimumTier}</output>
		</>
	);
}

afterEach((): void => {
	cleanup();
	customersQuery.mockReset();
	tiersState.enabled = false;
});

describe("MerchantRewardAudienceFields", () => {
	it("is for everyone by default, with no customer search", (): void => {
		render(<Harness />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("radio", { name: /Everyone/u }).getAttribute("aria-checked")).toBe("true");
		expect(screen.queryByRole("searchbox")).toBeNull();
		expect(customersQuery).not.toHaveBeenCalled();
	});

	it("searches the tenant's customers once chosen customers is picked, and keeps who was ticked", (): void => {
		customersQuery.mockReturnValue({ data: { data: [ALICE] }, isPending: false, isError: false });
		render(<Harness />, { wrapper: UiKitTestProviders });
		act((): void => {
			fireEvent.click(screen.getByRole("radio", { name: /Chosen customers/u }));
		});
		expect(customersQuery).toHaveBeenCalledWith({ tenantSlug: "sunrise-cafe", page: 1, limit: 20 }, expect.anything());
		act((): void => {
			fireEvent.click(screen.getByRole("checkbox", { name: /Alice Johnson/u }));
		});
		expect(screen.getByLabelText("Audience").textContent).toBe(`SELECTED_CUSTOMERS:${ALICE.userId}`);
		expect(screen.getByRole("button", { name: "Remove Alice Johnson" })).toBeTruthy();
	});

	it("offers no minimum tier while tiers are off", (): void => {
		render(<Harness />, { wrapper: UiKitTestProviders });
		expect(screen.queryByLabelText("Minimum tier", { selector: "button,[role=combobox]" })).toBeNull();
	});

	it("takes a minimum tier for a reward for everyone while tiers are on, and hides it for chosen customers (ADR 085)", async (): Promise<void> => {
		tiersState.enabled = true;
		customersQuery.mockReturnValue({ data: { data: [] }, isPending: false, isError: false });
		render(<Harness />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("combobox"));
		const silver = await screen.findByRole("option", { name: "Silver and above" });
		fireEvent.pointerDown(silver, { pointerType: "mouse" });
		fireEvent.click(silver);
		expect(screen.getByLabelText("Minimum tier", { selector: "output" }).textContent).toBe("SILVER");

		act((): void => {
			fireEvent.click(screen.getByRole("radio", { name: /Chosen customers/u }));
		});
		expect(screen.queryByRole("combobox")).toBeNull();
	});
});
