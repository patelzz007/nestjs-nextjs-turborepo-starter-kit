// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRewardDetailPageView } from "@/contexts/rewards/components/merchant-reward-detail-page-view";
import { MERCHANT_REWARD_LOADING_LABELS } from "@/components/loading/merchant-page-skeletons";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { busyRegionAnnouncements } from "@/test/skeleton";
import { contextQueryState, TWO_STORE_CONTEXT } from "@/test/tenant-context";
import { rewardFixture } from "@/test/rewards";
import { tenantRoutes } from "@/lib/routes";
import { ApiError } from "@workspace/client/lib/api/use-api";
import { epochMs, type RewardResponse } from "@workspace/shared";

const REWARD_ID = "0b6e2c1a-3d4f-4a5b-8c9d-1e2f3a4b5c6d";

const { rewardQuery, publishMutation, publish } = vi.hoisted(() => ({
	rewardQuery: vi.fn(),
	publishMutation: vi.fn(),
	publish: vi.fn(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				rewards: { get: { useQuery: rewardQuery }, publish: { useMutation: publishMutation } },
				context: { useQuery: (): object => contextQueryState(TWO_STORE_CONTEXT) },
			},
		},
	}),
}));

/** jsdom has no ResizeObserver; the gallery observes its size. */
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

const DRAFT: RewardResponse = rewardFixture({
	id: REWARD_ID,
	title: "Free latte",
	description: "One free latte with any breakfast set.",
	rewardType: "DISCOUNT",
	rewardValue: 20,
	termsConditions: "Dine-in only.",
	startDate: epochMs(1_793_491_200_000),
	quantityTotal: 100,
	quantityRemaining: 80,
	claimCount: 20,
	redemptionCount: 10,
	category: "cafe",
	rules: { minSpendMyr: 30, maxUsePerUser: 2 },
	status: "DRAFT",
});

function rewardReturns(state: object): void {
	rewardQuery.mockReturnValue({ data: undefined, isSuccess: false, isError: false, error: null, refetch: vi.fn(), ...state });
}

function renderPage(): void {
	renderWithAuthorization(<MerchantRewardDetailPageView tenantSlug={TEST_ORG_SLUG} rewardId={REWARD_ID} />, { role: "OWNER" });
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	rewardReturns({ data: { data: DRAFT }, isSuccess: true });
	publishMutation.mockReturnValue({ mutate: publish, isPending: false });
});

afterEach((): void => {
	cleanup();
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe("MerchantRewardDetailPageView", () => {
	it("leads with the offer, the title and what the status means", () => {
		renderPage();

		expect(screen.getByText("20% off")).toBeTruthy();
		expect(screen.getByRole("heading", { level: 1, name: "Free latte" })).toBeTruthy();
		expect(screen.getByText("One free latte with any breakfast set.")).toBeTruthy();
		expect(document.querySelector('[data-slot="reward-status-note"]')?.textContent).toContain("Only your team can see this draft");
	});

	it("shows how the reward is doing: claims, redemptions and stock", () => {
		renderPage();
		const performance = within(screen.getByRole("region", { name: "Performance" }));

		expect(performance.getByText("Claimed").nextElementSibling?.textContent).toBe("20");
		expect(performance.getByText("Redeemed").nextElementSibling?.textContent).toBe("10");
		expect(performance.getByText("80 of 100 left")).toBeTruthy();
	});

	it("lists every detail in words, and the terms beside them", () => {
		renderPage();
		const details = within(screen.getByRole("region", { name: "Details" }));

		expect(details.getByText("1 Nov 2026 – 14 Nov 2026")).toBeTruthy();
		expect(details.getByText("Up to 2 times")).toBeTruthy();
		expect(details.getByText(/^RM\s?30\.00$/u)).toBeTruthy();
		expect(details.getByText("Bukit Katil").getAttribute("title")).toBe("Jonker Street Kitchen — Bukit Katil");
		expect(within(screen.getByRole("region", { name: "Terms and conditions" })).getByText("Dine-in only.")).toBeTruthy();
	});

	it("submits a draft for review from the page", () => {
		renderPage();

		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
		});

		expect(publish).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, rewardId: REWARD_ID });
	});

	it("leads back to the catalog", () => {
		renderPage();

		expect(screen.getByRole("link", { name: "Rewards" }).getAttribute("href")).toBe(tenantRoutes(TEST_ORG_SLUG).rewards.list);
	});

	it("draws the page's own skeleton — not 'reward not found' — while the reward resolves", () => {
		rewardReturns({});
		renderPage();

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REWARD_LOADING_LABELS.loading]);
		expect(screen.queryByText("Reward not found")).toBeNull();
	});

	it("says the reward was not found when the API answers 404 (no such reward at the member's stores)", () => {
		rewardReturns({ isError: true, error: new ApiError({ message: "Reward not found", statusCode: 404 }) });
		renderPage();

		expect(screen.getByRole("heading", { name: "Reward not found" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Back to rewards" }).getAttribute("href")).toBe(tenantRoutes(TEST_ORG_SLUG).rewards.list);
	});

	it("shows a load failure as an error with a retry, without leaking the server's message", () => {
		const refetch = vi.fn();
		rewardReturns({ isError: true, error: new ApiError({ message: "upstream timeout", statusCode: 504 }), refetch });
		renderPage();

		expect(screen.getByRole("heading", { name: "Could not load this reward" })).toBeTruthy();
		expect(screen.queryByText("upstream timeout")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalled();
	});
});
