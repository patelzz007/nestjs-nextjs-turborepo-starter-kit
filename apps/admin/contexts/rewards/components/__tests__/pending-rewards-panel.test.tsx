// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within, type RenderResult } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/contexts/authorization";
import { LIST_SLOT_INDEX, ApiPaginatedMetaSchema, PERMISSION, type ApiPaginatedMeta } from "@workspace/shared";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PendingRewardsPanel, { resolveQueueStatus } from "../pending-rewards-panel";

/** Only the reward fields the queue renders. */
interface RewardImageStub {
	readonly fileId: string;
	readonly url: string;
	readonly width: number;
	readonly height: number;
	readonly sources: readonly { readonly width: number; readonly url: string }[];
}

interface PendingRewardStub {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly tenantName?: string | undefined;
	readonly rewardType: string;
	readonly status: string;
	readonly quantityRemaining: number;
	readonly quantityTotal: number;
	readonly expiryDate: number;
	readonly category: string;
	readonly images: readonly RewardImageStub[];
}

interface PendingQueryStub {
	readonly data: { readonly data: readonly PendingRewardStub[]; readonly meta: ApiPaginatedMeta } | undefined;
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly refetch: () => Promise<void>;
}

interface PendingQueryInput {
	readonly page: number;
	readonly limit: number;
}

const { pendingQuery, refetch } = vi.hoisted(() => ({
	pendingQuery: vi.fn<(input: PendingQueryInput) => PendingQueryStub>(),
	refetch: vi.fn<() => Promise<void>>(),
}));

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: () => void; readonly replace: () => void } => ({ push: (): void => undefined, replace: (): void => undefined }),
	usePathname: (): string => window.location.pathname,
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { rewardsAdmin: { pendingRewards: { useQuery: pendingQuery } } } }),
}));

const COVER: RewardImageStub = {
	fileId: "9f1c2b7e-4d3a-4c8e-9b6f-2a1d5e7c3b40",
	url: "https://files.example.com/rewards/free-coffee-cover.webp",
	width: 3840,
	height: 2160,
	sources: [
		{ width: 640, url: "https://files.example.com/rewards/free-coffee-cover-640.webp" },
		{ width: 3840, url: "https://files.example.com/rewards/free-coffee-cover.webp" },
	],
};

const REWARD: PendingRewardStub = {
	id: "5b2c7e19-0d4a-4e8f-9a3b-6c1d2e3f4a5b",
	title: "Free coffee",
	description: "One free latte",
	tenantName: "Sunrise Café",
	rewardType: "FREE_ITEM",
	status: "PENDING_REVIEW",
	quantityRemaining: 10,
	quantityTotal: 10,
	expiryDate: 1_786_300_000_000,
	category: "cafe",
	images: [COVER, { ...COVER, fileId: "8e0b1a6d-3c29-4b7d-8a5e-1f0c4d6b2a39", url: "https://files.example.com/rewards/free-coffee-counter.webp" }],
};

function pageMeta(page: number, total: number, totalPages: number): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "corr",
		timestamp: 1_786_300_000_000,
		page,
		limit: 10,
		total,
		totalPages,
		nextCursor: null,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	});
}

function renderPanel(): RenderResult {
	return render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={[PERMISSION.REWARD.APPROVE, PERMISSION.REWARD.REJECT]}>
				<PendingRewardsPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>,
		{ wrapper: ClientTestProviders },
	);
}

beforeEach(() => {
	window.history.replaceState(null, "", "/rewards/review");
	refetch.mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("PendingRewardsPanel", () => {
	it("shows the server's queue size, and each reward as a compact row that opens its page", () => {
		pendingQuery.mockReturnValue({ data: { data: [REWARD], meta: pageMeta(1, 23, 3) }, isLoading: false, isError: false, refetch });
		renderPanel();

		expect(screen.getByText("Moderation queue (23)")).toBeDefined();
		const row = screen.getByRole("article", { name: "Free coffee" });
		expect(within(row).getByRole("heading", { level: 2, name: "Free coffee" })).toBeDefined();
		expect(within(row).getByText("Sunrise Café")).toBeDefined();
		const viewMore = within(row).getByRole("link", { name: "View more about Free coffee" });
		expect(viewMore.textContent).toBe("View more");
		expect(viewMore.getAttribute("href")).toBe(`/rewards/review/${REWARD.id}`);
	});

	it("keeps the row to the cover, title and merchant — the decision happens on the reward's page", () => {
		pendingQuery.mockReturnValue({ data: { data: [REWARD], meta: pageMeta(1, 1, 1) }, isLoading: false, isError: false, refetch });
		const { container } = renderPanel();

		const row = screen.getByRole("article", { name: "Free coffee" });
		// One thumbnail — the cover — never a carousel of every photo.
		const thumbnails = [...row.querySelectorAll('[data-slot="cover-image"] img')];
		expect(thumbnails.map((thumbnail) => thumbnail.getAttribute("src"))).toEqual([COVER.url]);
		expect(container.querySelector('[data-slot="image-carousel"]')).toBeNull();
		expect(within(row).queryByText("One free latte")).toBeNull();
		expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
	});

	it("names the merchant generically when the API leaves the name out", () => {
		const withoutMerchant: PendingRewardStub = { ...REWARD, tenantName: undefined };
		pendingQuery.mockReturnValue({ data: { data: [withoutMerchant], meta: pageMeta(1, 1, 1) }, isLoading: false, isError: false, refetch });
		renderPanel();

		expect(within(screen.getByRole("article", { name: "Free coffee" })).getByText("Merchant")).toBeDefined();
	});

	it("queries the page the URL names, and pages through the queue", () => {
		window.history.replaceState(null, "", "/rewards/review?page=2");
		pendingQuery.mockReturnValue({ data: { data: [REWARD], meta: pageMeta(2, 23, 3) }, isLoading: false, isError: false, refetch });
		renderPanel();

		expect(pendingQuery.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({ page: 2, limit: 10 });
		expect(screen.getByText("Page 2 of 3")).toBeDefined();
	});

	it("shows row skeletons inside the queue card while the first page loads", () => {
		pendingQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch });
		renderPanel();

		const status = screen.getByRole("status");
		expect(status.getAttribute("aria-busy")).toBe("true");
		expect(status.textContent).toBe("Loading pending rewards…");
		expect(status.querySelector('[data-skeleton="pending-reward"]')).not.toBeNull();
		expect(screen.queryByText("No rewards waiting for review.")).toBeNull();
	});

	it("says so when nothing is waiting", () => {
		pendingQuery.mockReturnValue({ data: { data: [], meta: pageMeta(1, 0, 1) }, isLoading: false, isError: false, refetch });
		renderPanel();

		expect(screen.getByText("No rewards waiting for review.")).toBeDefined();
		expect(screen.queryByRole("list")).toBeNull();
	});

	it("shows a retryable error — not 'no rewards' — when the queue fails to load", () => {
		pendingQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
		renderPanel();

		expect(screen.queryByText("No rewards waiting for review.")).toBeNull();
		expect(screen.getByRole("alert").textContent).toContain("Couldn't load the moderation queue.");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});
});

describe("resolveQueueStatus", () => {
	it("keeps rows over an error, and tells loading, error and empty apart", () => {
		expect(resolveQueueStatus(true, false, 3)).toBe("ready");
		expect(resolveQueueStatus(true, false, 0)).toBe("error");
		expect(resolveQueueStatus(false, true, 0)).toBe("loading");
		expect(resolveQueueStatus(false, false, 0)).toBe("empty");
	});
});
