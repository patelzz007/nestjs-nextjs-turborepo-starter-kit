// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { LIST_SLOT_INDEX, ApiPaginatedMetaSchema, PERMISSION, type ApiPaginatedMeta } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PendingRewardsPanel, { resolveQueueStatus } from "../pending-rewards-panel";

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

type PageMetaStub = ApiPaginatedMeta;

interface PendingQueryStub {
	readonly data: { readonly data: readonly PendingRewardStub[]; readonly meta: PageMetaStub } | undefined;
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
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
	usePathname: (): string => window.location.pathname,
}));

vi.mock("@workspace/client/lib/auth", () => {
	const mutation = { useMutation: (): { readonly mutate: () => void; readonly isPending: boolean } => ({ mutate: (): void => undefined, isPending: false }) };
	return {
		useAuth: (): object => ({
			api: { rewardsAdmin: { pendingRewards: { useQuery: pendingQuery }, approveReward: mutation, rejectReward: mutation } },
		}),
	};
});

const REWARD: PendingRewardStub = {
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

function pageMeta(page: number, total: number, totalPages: number): PageMetaStub {
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

function renderPanel(): void {
	render(
		<QueryClientProvider client={new QueryClient()}>
			<CapabilitiesProvider capabilities={[PERMISSION.REWARD.MANAGE]}>
				<PendingRewardsPanel />
			</CapabilitiesProvider>
		</QueryClientProvider>,
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
	it("shows approve/reject and the server's queue size", () => {
		pendingQuery.mockReturnValue({ data: { data: [REWARD], meta: pageMeta(1, 23, 3) }, isLoading: false, isError: false, refetch });
		renderPanel();

		expect(screen.getByText("Free coffee")).toBeDefined();
		expect(screen.getByRole("button", { name: "Approve" })).toBeDefined();
		expect(screen.getByText("Moderation queue (23)")).toBeDefined();
		expect(screen.getByText("Page 1 of 3")).toBeDefined();
	});

	it("queries the page the URL names", () => {
		window.history.replaceState(null, "", "/rewards/review?page=2");
		pendingQuery.mockReturnValue({ data: { data: [REWARD], meta: pageMeta(2, 23, 3) }, isLoading: false, isError: false, refetch });
		renderPanel();

		expect(pendingQuery.mock.lastCall?.[LIST_SLOT_INDEX.first]).toMatchObject({ page: 2, limit: 10 });
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
