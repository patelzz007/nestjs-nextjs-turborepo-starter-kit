// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PendingRewardsPanel from "../pending-rewards-panel";

/** Only the reward fields the panel renders. */
interface PendingRewardStub {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly organizationName: string;
	readonly rewardType: string;
	readonly status: string;
	readonly quantityRemaining: number;
	readonly quantityTotal: number;
	readonly expiryDate: number;
	readonly category: string;
}

interface MutationHookStub {
	readonly useMutation: () => { readonly mutate: () => void; readonly isPending: boolean };
}

interface AuthStub {
	readonly api: {
		readonly rewardsAdmin: {
			readonly pendingRewards: { readonly useQuery: () => { readonly data: { readonly data: readonly PendingRewardStub[] }; readonly isLoading: boolean } };
			readonly approveReward: MutationHookStub;
			readonly rejectReward: MutationHookStub;
		};
	};
}

vi.mock("@workspace/client/lib/auth", () => {
	const reward: PendingRewardStub = {
		id: "reward-1",
		title: "Free coffee",
		description: "One free latte",
		organizationName: "Sunrise Café",
		rewardType: "FREE_ITEM",
		status: "PENDING_REVIEW",
		quantityRemaining: 10,
		quantityTotal: 10,
		expiryDate: 1_786_300_000_000,
		category: "FOOD",
	};
	const mutation: MutationHookStub = { useMutation: () => ({ mutate: () => undefined, isPending: false }) };
	const auth: AuthStub = {
		api: {
			rewardsAdmin: {
				pendingRewards: { useQuery: () => ({ data: { data: [reward] }, isLoading: false }) },
				approveReward: mutation,
				rejectReward: mutation,
			},
		},
	};
	return { useAuth: (): AuthStub => auth };
});

function renderPanel(capabilities: readonly CapabilitySlug[]): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={capabilities}>
				<PendingRewardsPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
});

describe("PendingRewardsPanel authorization", () => {
	it("shows approve/reject with REWARD manage", () => {
		renderPanel([PERMISSION.REWARD.MANAGE]);
		expect(screen.getByText("Free coffee")).toBeDefined();
		expect(screen.getByRole("button", { name: "Approve" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Reject" })).toBeDefined();
	});
});
