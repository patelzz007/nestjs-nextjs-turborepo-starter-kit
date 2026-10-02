// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import { RewardDetailView } from "@/components/rewardhub/detail/view";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";

/** Only the reward fields the detail view reads. */
interface RewardStub {
	readonly id: string;
	readonly organizationName: string;
	readonly organizationLogoUrl: string | null;
	readonly title: string;
	readonly description: string;
	readonly category: string;
	readonly rewardType: string;
	readonly status: string;
	readonly quantityRemaining: number;
	readonly expiryDate: number;
}

interface CheckoutStub {
	readonly hasAcceptedLegal: boolean;
	readonly phoneVerified: boolean;
	readonly phone: string | null;
}

interface MutationStub {
	readonly isPending: boolean;
	readonly mutateAsync: () => Promise<void>;
}

const REWARD_ID = "reward-1";
const DAY_MS = 86_400_000;

const { rewardUseQuery, legalStatusUseQuery } = vi.hoisted(() => ({
	rewardUseQuery: vi.fn<() => { readonly data: { readonly data: RewardStub } | undefined; readonly isLoading: boolean; readonly refetch: () => Promise<void> }>(),
	legalStatusUseQuery: vi.fn<() => { readonly data: { readonly data: CheckoutStub } | undefined; readonly refetch: () => Promise<void> }>(),
}));

function mutationStub(): MutationStub {
	return { isPending: false, mutateAsync: (): Promise<void> => Promise.resolve() };
}

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): {
		readonly api: {
			readonly rewards: { readonly detail: { readonly useQuery: typeof rewardUseQuery } };
			readonly legal: { readonly status: { readonly useQuery: typeof legalStatusUseQuery }; readonly accept: { readonly useMutation: () => MutationStub } };
			readonly claims: { readonly otp: { readonly useMutation: () => MutationStub }; readonly create: { readonly useMutation: () => MutationStub } };
		};
	} => ({
		api: {
			rewards: { detail: { useQuery: rewardUseQuery } },
			legal: { status: { useQuery: legalStatusUseQuery }, accept: { useMutation: mutationStub } },
			claims: { otp: { useMutation: mutationStub }, create: { useMutation: mutationStub } },
		},
	}),
}));

vi.mock("next/navigation", () => ({
	usePathname: (): string => `/rewards/${REWARD_ID}`,
	useRouter: (): { readonly push: () => void } => ({ push: (): void => undefined }),
}));

function buildReward(overrides: Partial<RewardStub> = {}): RewardStub {
	return {
		id: REWARD_ID,
		organizationName: "Brew & Bean KL",
		organizationLogoUrl: null,
		title: "Free coffee",
		description: "One free latte",
		category: "food",
		rewardType: "FREE_ITEM",
		status: "PUBLISHED",
		quantityRemaining: 10,
		expiryDate: Date.now() + DAY_MS,
		...overrides,
	};
}

function renderView(session: WebSessionState): void {
	render(
		<WebSessionTestProvider session={session}>
			<RewardDetailView rewardId={REWARD_ID} />
		</WebSessionTestProvider>,
	);
}

beforeEach(() => {
	rewardUseQuery.mockReset();
	legalStatusUseQuery.mockReset();
	rewardUseQuery.mockReturnValue({ data: { data: buildReward() }, isLoading: false, refetch: (): Promise<void> => Promise.resolve() });
	legalStatusUseQuery.mockReturnValue({
		data: { data: { hasAcceptedLegal: false, phoneVerified: false, phone: null } },
		refetch: (): Promise<void> => Promise.resolve(),
	});
});

afterEach(() => {
	cleanup();
});

describe("RewardDetailView claim gating", () => {
	it("shows anonymous visitors a sign-in prompt instead of the claim flow", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByText("Free coffee")).toBeDefined();
		expect(screen.getByText("Sign in or create a free account to claim this reward.")).toBeDefined();
		expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(`/auth/login?redirect=%2Frewards%2F${REWARD_ID}`);
		expect(screen.queryByRole("button", { name: "Accept & continue" })).toBeNull();
		expect(legalStatusUseQuery).not.toHaveBeenCalled();
	});

	it("shows the claim flow to any signed-in user (claiming needs no permission)", () => {
		renderView(signedInSession());

		expect(screen.getByRole("button", { name: "Accept & continue" })).toBeDefined();
		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
		expect(legalStatusUseQuery).toHaveBeenCalled();
	});

	it("goes straight to the claim button once terms are accepted and the phone is verified", () => {
		legalStatusUseQuery.mockReturnValue({
			data: { data: { hasAcceptedLegal: true, phoneVerified: true, phone: "+60123456789" } },
			refetch: (): Promise<void> => Promise.resolve(),
		});
		renderView(signedInSession());

		expect(screen.getByRole("button", { name: "Claim reward" })).toBeDefined();
	});

	it("explains unavailability instead of prompting sign-in for a sold-out reward", () => {
		rewardUseQuery.mockReturnValue({ data: { data: buildReward({ quantityRemaining: 0 }) }, isLoading: false, refetch: (): Promise<void> => Promise.resolve() });
		renderView(GUEST_SESSION_STATE);

		expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
		expect(screen.getByRole("link", { name: "Browse other offers" })).toBeDefined();
	});
});

describe("RewardDetailView merchant identity", () => {
	const LOGO_URL = "https://cdn.example.com/organizations/brew-bean/logo.png";

	it("names the offering shop beside its logo", () => {
		rewardUseQuery.mockReturnValue({
			data: { data: buildReward({ organizationLogoUrl: LOGO_URL }) },
			isLoading: false,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		const { container } = render(
			<WebSessionTestProvider session={GUEST_SESSION_STATE}>
				<RewardDetailView rewardId={REWARD_ID} />
			</WebSessionTestProvider>,
		);

		expect(screen.getByText("Brew & Bean KL")).toBeDefined();
		expect(container.querySelector("[data-slot=entity-avatar] img")?.getAttribute("src")).toBe(LOGO_URL);
	});

	it("shows the shop's monogram when it has no logo", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByText("Brew & Bean KL")).toBeDefined();
		expect(screen.getByText("BK")).toBeDefined();
	});
});
