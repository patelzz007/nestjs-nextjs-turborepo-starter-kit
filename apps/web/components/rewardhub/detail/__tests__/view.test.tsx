// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebSessionTestProvider, type WebSessionState } from "@/components/auth/web-authorization-provider";
import { CLAIM_OPTIONS_LOADING_LABELS, REWARD_DETAIL_LOADING_LABELS } from "@/components/loading/loading-labels";
import { RewardDetailView } from "@/components/rewardhub/detail/view";
import { expectSingleLoadingStatus } from "@/test-support/skeleton";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { GUEST_SESSION_STATE, signedInSession } from "@/test-support/session";
import { buildRewardResponse, FIXTURE_COVER_IMAGE_URL, rewardImageFixture, type RewardFixtureOverrides } from "@/test-support/reward";
import type { RewardResponse } from "@workspace/shared";

interface CheckoutStub {
	readonly hasAcceptedLegal: boolean;
	readonly phoneVerified: boolean;
	readonly phone: string | null;
}

interface MutationStub {
	readonly isPending: boolean;
	readonly mutateAsync: () => Promise<void>;
}

const REWARD_ID = "00000000-0000-4000-8000-000000000001";
const DAY_MS = 86_400_000;
const SECOND_IMAGE_URL = "https://cdn.example.com/rewards/free-coffee/counter.webp";

const { rewardUseQuery, legalStatusUseQuery, rewardListUseQuery } = vi.hoisted(() => ({
	rewardUseQuery: vi.fn<() => { readonly data: { readonly data: RewardResponse } | undefined; readonly isLoading: boolean; readonly refetch: () => Promise<void> }>(),
	rewardListUseQuery: vi.fn<(query: object) => { readonly data: { readonly data: readonly RewardResponse[] } | undefined }>(),
	legalStatusUseQuery: vi.fn<() => { readonly data: { readonly data: CheckoutStub } | undefined; readonly refetch: () => Promise<void> }>(),
}));

function mutationStub(): MutationStub {
	return { isPending: false, mutateAsync: (): Promise<void> => Promise.resolve() };
}

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): {
		readonly api: {
			readonly rewards: { readonly detail: { readonly useQuery: typeof rewardUseQuery }; readonly list: { readonly useQuery: typeof rewardListUseQuery } };
			readonly legal: { readonly status: { readonly useQuery: typeof legalStatusUseQuery }; readonly accept: { readonly useMutation: () => MutationStub } };
			readonly claims: { readonly otp: { readonly useMutation: () => MutationStub }; readonly create: { readonly useMutation: () => MutationStub } };
		};
	} => ({
		api: {
			rewards: { detail: { useQuery: rewardUseQuery }, list: { useQuery: rewardListUseQuery } },
			legal: { status: { useQuery: legalStatusUseQuery }, accept: { useMutation: mutationStub } },
			claims: { otp: { useMutation: mutationStub }, create: { useMutation: mutationStub } },
		},
	}),
}));

vi.mock("next/navigation", () => ({
	usePathname: (): string => `/rewards/${REWARD_ID}`,
	useRouter: (): { readonly push: () => void } => ({ push: (): void => undefined }),
}));

function buildReward(overrides: RewardFixtureOverrides = {}): RewardResponse {
	return buildRewardResponse({
		id: REWARD_ID,
		organizationName: "Brew & Bean KL",
		title: "Free coffee",
		category: "food",
		expiryDate: Date.now() + 10 * DAY_MS,
		...overrides,
	});
}

function renderView(session: WebSessionState): void {
	render(
		<WebSessionTestProvider session={session}>
			<RewardDetailView rewardId={REWARD_ID} />
		</WebSessionTestProvider>,
		{ wrapper: UiKitTestProviders },
	);
}

beforeEach(() => {
	rewardUseQuery.mockReset();
	legalStatusUseQuery.mockReset();
	rewardListUseQuery.mockReset();
	rewardListUseQuery.mockReturnValue({ data: { data: [] } });
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

describe("RewardDetailView loading", () => {
	it("shows a reward-shaped skeleton, announced once, until the reward arrives", () => {
		rewardUseQuery.mockReturnValue({ data: undefined, isLoading: true, refetch: (): Promise<void> => Promise.resolve() });
		renderView(GUEST_SESSION_STATE);

		expectSingleLoadingStatus(REWARD_DETAIL_LOADING_LABELS.loading);
		expect(screen.queryByRole("heading", { name: "Reward unavailable" })).toBeNull();
	});

	it("shows a claim-form skeleton while a signed-in user's claim options load", () => {
		legalStatusUseQuery.mockReturnValue({ data: undefined, refetch: (): Promise<void> => Promise.resolve() });
		renderView(signedInSession());

		expect(screen.getByText("Free coffee")).toBeDefined();
		expectSingleLoadingStatus(CLAIM_OPTIONS_LOADING_LABELS.loading);
		expect(screen.queryByRole("button", { name: "Accept & continue" })).toBeNull();
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
			{ wrapper: UiKitTestProviders },
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

/** The photo carousel (Embla) observes sizes and slide visibility — jsdom implements neither. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

describe("RewardDetailView gallery", () => {
	beforeEach((): void => {
		vi.stubGlobal("ResizeObserver", NoopObserver);
		vi.stubGlobal("IntersectionObserver", NoopObserver);
		window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
	});

	it("leads with the cover, eagerly loaded, offering every rendition", () => {
		renderView(GUEST_SESSION_STATE);

		const cover = document.querySelector<HTMLImageElement>("[data-slot=cover-image] img");
		expect(cover?.getAttribute("src")).toBe(FIXTURE_COVER_IMAGE_URL);
		expect(cover?.getAttribute("srcset")).toContain(`${FIXTURE_COVER_IMAGE_URL} 3840w`);
		expect(cover?.getAttribute("alt")).toBe("Free coffee — cover photo");
		expect(cover?.getAttribute("loading")).toBe("eager");
		expect(document.querySelector("[data-slot=image-carousel]")).toBeNull();
	});

	it("shows several photos as a carousel, cover first, the rest loaded lazily", () => {
		rewardUseQuery.mockReturnValue({
			data: {
				data: buildReward({
					images: [
						rewardImageFixture("00000000-0000-4000-8000-0000000000c1", FIXTURE_COVER_IMAGE_URL),
						rewardImageFixture("00000000-0000-4000-8000-0000000000c2", SECOND_IMAGE_URL),
					],
				}),
			},
			isLoading: false,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		renderView(GUEST_SESSION_STATE);

		expect(document.querySelector("[data-slot=image-carousel]")).not.toBeNull();
		const images = [...document.querySelectorAll<HTMLImageElement>("[data-slot=cover-image] img")];
		expect(images.map((image) => [image.getAttribute("src"), image.getAttribute("loading")])).toEqual([
			[FIXTURE_COVER_IMAGE_URL, "eager"],
			[SECOND_IMAGE_URL, "lazy"],
		]);
		expect(screen.getByRole("button", { name: "Show image 2" })).toBeDefined();
	});
});

describe("RewardDetailView offer details", () => {
	it("states the offer, its stock and its end date as the page's heading block", () => {
		rewardUseQuery.mockReturnValue({
			data: { data: buildReward({ rewardType: "DISCOUNT", rewardValue: 15, quantityTotal: 50, quantityRemaining: 8, claimCount: 42 }) },
			isLoading: false,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByRole("heading", { level: 1, name: "Free coffee" })).toBeDefined();
		expect(screen.getByText("15% off")).toBeDefined();
		expect(screen.getByText("Discount")).toBeDefined();
		expect(screen.getByText("8 of 50 left")).toBeDefined();
		expect(screen.getByText("Almost gone")).toBeDefined();
		expect(screen.getByText("42")).toBeDefined();
	});

	it("names the reward type only where the offer does not already say it", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.getAllByText("Free item")).toHaveLength(1);
	});

	it("flags an offer ending within days", () => {
		rewardUseQuery.mockReturnValue({
			data: { data: buildReward({ expiryDate: Date.now() + 2 * DAY_MS - 1000 }) },
			isLoading: false,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByText("Ending soon")).toBeDefined();
		expect(screen.getByText("(2 days left)")).toBeDefined();
	});

	it("explains how a claimed offer is used", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByRole("heading", { name: "How it works" })).toBeDefined();
		expect(screen.getByText("Show it before you pay")).toBeDefined();
	});

	it("spells out the fine print: stores, minimum spend, per-person limit and terms", () => {
		rewardUseQuery.mockReturnValue({
			data: {
				data: buildReward({
					rules: { minSpendMyr: 30, maxUsePerUser: 2 },
					termsConditions: "Dine-in only.",
					locationScopeType: "SELECTED",
					locationIds: ["00000000-0000-4000-8000-0000000000d1"],
					locationNames: ["Brew & Bean KL — Bangsar"],
				}),
			},
			isLoading: false,
			refetch: (): Promise<void> => Promise.resolve(),
		});
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByText("Brew & Bean KL — Bangsar")).toBeDefined();
		// Testing Library normalises the no-break space Intl puts after the currency symbol.
		expect(screen.getByText("RM 30 on one bill")).toBeDefined();
		expect(screen.getByText("Up to 2 per person")).toBeDefined();
		expect(screen.getByText("Dine-in only.")).toBeDefined();
	});

	it("says plainly when there is no minimum, one per person and no extra terms", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.getByText("Any Brew & Bean KL store")).toBeDefined();
		expect(screen.getByText("None — use it on any bill")).toBeDefined();
		expect(screen.getByText("One per person")).toBeDefined();
		expect(screen.getByText("No extra terms from the merchant.")).toBeDefined();
	});

	it("has no back link of its own — the page around it provides navigation", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.queryByRole("link", { name: /back/iu })).toBeNull();
	});
});

describe("RewardDetailView more from the merchant", () => {
	it("lists the merchant's other live offers, linking to the same kind of detail page", () => {
		const other = buildRewardResponse({ id: "00000000-0000-4000-8000-000000000002", title: "Free croissant" });
		rewardListUseQuery.mockReturnValue({ data: { data: [buildReward(), other] } });
		render(
			<WebSessionTestProvider session={GUEST_SESSION_STATE}>
				<RewardDetailView rewardId={REWARD_ID} detailPathPrefix="/rewards" />
			</WebSessionTestProvider>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("heading", { name: "More from Brew & Bean KL" })).toBeDefined();
		expect(screen.getByText("Free croissant")).toBeDefined();
		expect(screen.getAllByRole("link", { name: "View offer" }).map((link) => link.getAttribute("href"))).toEqual([`/rewards/${other.id}`]);
		expect(rewardListUseQuery).toHaveBeenCalledWith(expect.objectContaining({ filter: { organizationId: { eq: "00000000-0000-4000-8000-0000000000aa" } } }));
	});

	it("leaves the section out when the merchant has nothing else live", () => {
		renderView(GUEST_SESSION_STATE);

		expect(screen.queryByRole("heading", { name: /^More from/u })).toBeNull();
	});
});
