// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, type RenderResult } from "@testing-library/react";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import { flushUrlUpdates } from "@workspace/client/testing/flush-url-updates";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { testEnvelope } from "@/testing/envelope";
import type { PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import {
	ApiPaginatedMetaSchema,
	PILOT_CITY_LABELS,
	PilotCitySchema,
	RewardCategorySchema,
	type ApiPaginatedMeta,
	type Envelope,
	type RewardResponse,
	type TierAvailability,
} from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardBrowseView } from "@/contexts/rewards/components/browse/view";
import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { REWARDS_BROWSE_PAGE_SIZE } from "@/contexts/rewards/url-state/rewards-browse";
import { buildRewardResponse } from "@/testing/reward";

type RewardsListInput = Parameters<typeof apiRouter.rewards.list.queryKey>[0];

interface RewardsListOptions {
	readonly initialData?: Envelope<RewardResponse[]>;
}

const { rewardsListQuery } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn<(input: RewardsListInput, options?: RewardsListOptions) => object>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({ api: { rewards: { list: { useQuery: rewardsListQuery } } } }),
}));

const PATH = "/dashboard";
const NEXT_CURSOR = "cursor-after-page-1";
const FIXTURE_NOW = 1_790_812_800_000;
const LATTE: RewardResponse = buildRewardResponse({ title: "Free latte" });

function paginatedMeta(page: number, hasNext: boolean): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "",
		timestamp: FIXTURE_NOW,
		limit: REWARDS_BROWSE_PAGE_SIZE,
		total: 30,
		page,
		totalPages: 3,
		nextCursor: hasNext ? NEXT_CURSOR : null,
		hasNext,
		hasPrevious: page > 1,
	});
}

function view(initialPage?: PrefetchedQuery<Envelope<RewardResponse[]>>, tierAvailability?: TierAvailability): React.JSX.Element {
	return (
		<UiPreferencesStoreProvider storageKey={WEB_UI_PREFERENCES_STORAGE_KEY} devtoolsName={WEB_UI_PREFERENCES_DEVTOOLS_NAME}>
			<DashboardBrowseView initialPage={initialPage} tierAvailability={tierAvailability} />
		</UiPreferencesStoreProvider>
	);
}

function renderAt(query: string, initialPage?: PrefetchedQuery<Envelope<RewardResponse[]>>, tierAvailability?: TierAvailability): RenderResult {
	window.history.replaceState(null, "", `${PATH}${query}`);
	return render(view(initialPage, tierAvailability), { wrapper: ClientTestProviders });
}

function lastQuery(): { readonly input: RewardsListInput | undefined; readonly options: RewardsListOptions | undefined } {
	const [input, options] = rewardsListQuery.mock.lastCall ?? [];
	return { input, options };
}

function isPressed(name: string): boolean {
	return screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";
}

beforeEach((): void => {
	window.localStorage.clear();
	rewardsListQuery.mockReturnValue({ data: { data: [LATTE], meta: paginatedMeta(1, true) }, isLoading: false });
});

afterEach((): void => {
	cleanup();
	rewardsListQuery.mockReset();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

describe("DashboardBrowseView locked rewards (ADR 085)", () => {
	const SILVER_VIEWER: TierAvailability = { enabled: true, viewerTier: "SILVER" };
	const GOLD_BRUNCH: RewardResponse = buildRewardResponse({ id: "00000000-0000-4000-8000-000000000002", title: "Gold brunch", minimumTier: "GOLD" });

	it("lists locked rewards while tiers are on, marks them, and offers to hide them", () => {
		rewardsListQuery.mockReturnValue({ data: { data: [LATTE, GOLD_BRUNCH], meta: paginatedMeta(1, false) }, isLoading: false });
		renderAt("", undefined, SILVER_VIEWER);

		expect(lastQuery().input).toEqual({ page: 1, limit: REWARDS_BROWSE_PAGE_SIZE, includeLocked: true });
		expect(isPressed("Hide locked")).toBe(false);
		expect(screen.getByText("Gold only")).toBeTruthy();
		expect(screen.getByRole("link", { name: "See how to unlock" })).toBeTruthy();
	});

	it("hides them through the URL, back on page 1, and clears with the other filters", async () => {
		renderAt("?page=2", undefined, SILVER_VIEWER);

		fireEvent.click(screen.getByRole("button", { name: "Hide locked" }));
		await flushUrlUpdates();

		expect(window.location.search).toBe("?hideLocked=true");
		expect(lastQuery().input).toEqual({ page: 1, limit: REWARDS_BROWSE_PAGE_SIZE });
		expect(isPressed("Hide locked")).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
		await flushUrlUpdates();
		expect(window.location.search).toBe("");
	});

	it("shows no tier filter and no tier marks while tiers are off", () => {
		rewardsListQuery.mockReturnValue({ data: { data: [GOLD_BRUNCH], meta: paginatedMeta(1, false) }, isLoading: false });
		renderAt("", undefined, { enabled: false });

		expect(lastQuery().input).toEqual({ page: 1, limit: REWARDS_BROWSE_PAGE_SIZE });
		expect(screen.queryByRole("button", { name: "Hide locked" })).toBeNull();
		expect(screen.queryByText("Gold only")).toBeNull();
	});
});

describe("DashboardBrowseView URL state", () => {
	it("queries exactly what the URL asks for and reflects it in the controls", () => {
		renderAt("?search=latte&filter[city]=MELAKA&filter[category]=cafe&page=2");

		expect(lastQuery().input).toEqual({
			page: 2,
			limit: REWARDS_BROWSE_PAGE_SIZE,
			search: "latte",
			filter: { city: { eq: "MELAKA" }, category: { eq: "cafe" } },
		});
		expect(screen.getByRole("textbox", { name: "Search rewards" })).toHaveProperty("value", "latte");
		expect(isPressed("Melaka")).toBe(true);
		expect(isPressed("All cities")).toBe(false);
		expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
	});

	it("pushes a filter chip to the URL and returns to page 1", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		renderAt("?page=3&filter[category]=cafe");

		fireEvent.click(screen.getByRole("button", { name: "Melaka" }));

		await flushUrlUpdates();
		expect(pushState).toHaveBeenCalledTimes(1);
		// Params already in the URL keep their place; a new one is appended.
		await flushUrlUpdates();
		expect(window.location.search).toBe("?filter[category]=cafe&filter[city]=MELAKA");
	});

	it("pushes a submitted search (trimmed) and keeps the other filters", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		renderAt("?filter[city]=KUALA_LUMPUR&page=2");

		fireEvent.change(screen.getByRole("textbox", { name: "Search rewards" }), { target: { value: "  flat white " } });
		await flushUrlUpdates();
		expect(pushState).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		await flushUrlUpdates();
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(new URLSearchParams(window.location.search).get("search")).toBe("flat white");
		expect(new URLSearchParams(window.location.search).get("filter[city]")).toBe("KUALA_LUMPUR");
		expect(new URLSearchParams(window.location.search).has("page")).toBe(false);
	});

	it("clears every filter in one history entry", async () => {
		renderAt("?search=latte&filter[city]=MELAKA&page=2");

		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

		await flushUrlUpdates();
		expect(window.location.search).toBe("");
	});

	it("pages forward with the response's keyset cursor and back by offset", async () => {
		const view1 = renderAt("");
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		await flushUrlUpdates();
		expect(window.location.search).toBe(`?page=2&cursor=${NEXT_CURSOR}`);

		rewardsListQuery.mockReturnValue({ data: { data: [LATTE], meta: paginatedMeta(3, false) }, isLoading: false });
		act((): void => {
			window.history.replaceState(null, "", `${PATH}?page=3`);
		});
		view1.rerender(view());
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		await flushUrlUpdates();
		expect(window.location.search).toBe("?page=2");
	});

	it("follows the URL on back/forward, including the search box", () => {
		const rendered = renderAt("?search=latte");
		fireEvent.change(screen.getByRole("textbox", { name: "Search rewards" }), { target: { value: "unsubmitted" } });

		act((): void => {
			window.history.replaceState(null, "", `${PATH}?search=spa&filter[category]=wellness`);
		});
		rendered.rerender(view());

		expect(lastQuery().input).toEqual({ page: 1, limit: REWARDS_BROWSE_PAGE_SIZE, search: "spa", filter: { city: undefined, category: { eq: "wellness" } } });
		expect(screen.getByRole("textbox", { name: "Search rewards" })).toHaveProperty("value", "spa");
	});
});

describe("DashboardBrowseView filters and states", () => {
	it('models "All cities" as no filter: clicking it removes the city from the URL', async () => {
		renderAt("?filter[city]=MELAKA&filter[category]=cafe");

		fireEvent.click(screen.getByRole("button", { name: "All cities" }));

		await flushUrlUpdates();
		expect(window.location.search).toBe("?filter[category]=cafe");
	});

	it('presses "All cities" exactly when the URL has no city filter', () => {
		renderAt("?filter[category]=cafe");

		expect(isPressed("All cities")).toBe(true);
		expect(isPressed("Melaka")).toBe(false);
	});

	it("offers one chip per pilot city and category from the shared enums", () => {
		renderAt("");

		for (const city of PilotCitySchema.options) {
			expect(screen.getByRole("button", { name: PILOT_CITY_LABELS[city] })).toBeTruthy();
		}
		for (const category of RewardCategorySchema.options) {
			expect(screen.getByRole("button", { name: category })).toBeTruthy();
		}
	});

	it("derives the Cities stat from the pilot cities instead of a hard-coded count", () => {
		renderAt("");

		expect(screen.getByText("Cities").nextElementSibling?.textContent).toBe(String(PilotCitySchema.options.length));
		expect(screen.getByText("Categories").nextElementSibling?.textContent).toBe(String(RewardCategorySchema.options.length));
	});

	it('shows a distinct error state with a retry — not "sold out or expired" — when the catalog fails to load', () => {
		const refetch = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
		rewardsListQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
		renderAt("");

		expect(screen.getByRole("heading", { name: "Couldn't load rewards" })).toBeTruthy();
		expect(screen.queryByText(/sold out or expired/)).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("keeps the empty state for a catalog that loaded with no matches", () => {
		rewardsListQuery.mockReturnValue({ data: { data: [], meta: paginatedMeta(1, false) }, isLoading: false, isError: false });
		renderAt("?filter[city]=MELAKA");

		expect(screen.getByRole("heading", { name: "No claimable rewards" })).toBeTruthy();
	});
});

describe("DashboardBrowseView server prefetch", () => {
	const PREFETCHED: Envelope<RewardResponse[]> = testEnvelope([LATTE], paginatedMeta(1, false));

	it("seeds the query with the page the server fetched for this URL", () => {
		renderAt("?filter[city]=MELAKA", { stateKey: "filter[city]=MELAKA", data: PREFETCHED });

		expect(lastQuery().options?.initialData).toBe(PREFETCHED);
	});

	it("never seeds a different URL state with the server's page", () => {
		renderAt("?filter[city]=MELAKA&page=2", { stateKey: "filter[city]=MELAKA", data: PREFETCHED });

		expect(lastQuery().options?.initialData).toBeUndefined();
	});
});
