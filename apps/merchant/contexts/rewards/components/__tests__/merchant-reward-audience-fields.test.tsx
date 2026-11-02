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

const { customersQuery } = vi.hoisted(() => ({
	customersQuery: vi.fn<(input: object) => CustomersQueryState>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { tenants: { rewards: { customers: { useQuery: customersQuery } } } } }),
}));

const ALICE: RewardCustomer = {
	userId: "0193f2c4-0000-7000-8000-0000000000a1",
	fullName: "Alice Johnson",
	maskedEmail: "a•••@example.com",
	lastClaimedAt: epochMs(Date.UTC(2026, 9, 1)),
	claimCount: 2,
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
		</>
	);
}

afterEach((): void => {
	cleanup();
	customersQuery.mockReset();
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
});
