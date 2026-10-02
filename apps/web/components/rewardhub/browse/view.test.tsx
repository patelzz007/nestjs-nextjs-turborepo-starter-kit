// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, type RenderResult } from "@testing-library/react";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { successEnvelope } from "@workspace/client/lib/api/envelope";
import type { PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { ApiPaginatedMetaSchema, type ApiPaginatedMeta, type Envelope, type RewardResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RewardHubBrowseView } from "@/components/rewardhub/browse/view";
import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { REWARDS_BROWSE_PAGE_SIZE } from "@/lib/url-state/rewards-browse";
import { buildRewardResponse } from "@/test-support/reward";

type RewardsListInput = Parameters<typeof apiRouter.rewards.list.queryKey>[0];

interface RewardsListOptions {
	readonly initialData?: Envelope<RewardResponse[]>;
}

const { rewardsListQuery } = vi.hoisted(() => ({
	rewardsListQuery: vi.fn<(input: RewardsListInput, options?: RewardsListOptions) => object>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { rewards: { list: { useQuery: rewardsListQuery } } } }),
}));

// The catalog reads its state from the address bar, as Next.js's
// `useSearchParams` does once its History API integration has synced it.
vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	return { ...actual, useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search) };
});

const PATH = "/rewardhub";
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

function view(initialPage?: PrefetchedQuery<Envelope<RewardResponse[]>>): React.JSX.Element {
	return (
		<UiPreferencesStoreProvider storageKey={WEB_UI_PREFERENCES_STORAGE_KEY} devtoolsName={WEB_UI_PREFERENCES_DEVTOOLS_NAME}>
			<RewardHubBrowseView initialPage={initialPage} />
		</UiPreferencesStoreProvider>
	);
}

function renderAt(query: string, initialPage?: PrefetchedQuery<Envelope<RewardResponse[]>>): RenderResult {
	window.history.replaceState(null, "", `${PATH}${query}`);
	return render(view(initialPage));
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

describe("RewardHubBrowseView URL state", () => {
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

	it("pushes a filter chip to the URL and returns to page 1", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		renderAt("?page=3&filter[category]=cafe");

		fireEvent.click(screen.getByRole("button", { name: "Melaka" }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe("?filter[city]=MELAKA&filter[category]=cafe");
	});

	it("pushes a submitted search (trimmed) and keeps the other filters", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		renderAt("?filter[city]=KUALA_LUMPUR&page=2");

		fireEvent.change(screen.getByRole("textbox", { name: "Search rewards" }), { target: { value: "  flat white " } });
		expect(pushState).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Search" }));

		expect(pushState).toHaveBeenCalledTimes(1);
		expect(new URLSearchParams(window.location.search).get("search")).toBe("flat white");
		expect(new URLSearchParams(window.location.search).get("filter[city]")).toBe("KUALA_LUMPUR");
		expect(new URLSearchParams(window.location.search).has("page")).toBe(false);
	});

	it("clears every filter in one history entry", () => {
		renderAt("?search=latte&filter[city]=MELAKA&page=2");

		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

		expect(window.location.search).toBe("");
	});

	it("pages forward with the response's keyset cursor and back by offset", () => {
		const view1 = renderAt("");
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(window.location.search).toBe(`?page=2&cursor=${NEXT_CURSOR}`);

		rewardsListQuery.mockReturnValue({ data: { data: [LATTE], meta: paginatedMeta(3, false) }, isLoading: false });
		act((): void => {
			window.history.replaceState(null, "", `${PATH}?page=3`);
		});
		view1.rerender(view());
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
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

describe("RewardHubBrowseView server prefetch", () => {
	const PREFETCHED: Envelope<RewardResponse[]> = successEnvelope([LATTE], paginatedMeta(1, false));

	it("seeds the query with the page the server fetched for this URL", () => {
		renderAt("?filter[city]=MELAKA", { stateKey: "filter[city]=MELAKA", data: PREFETCHED });

		expect(lastQuery().options?.initialData).toBe(PREFETCHED);
	});

	it("never seeds a different URL state with the server's page", () => {
		renderAt("?filter[city]=MELAKA&page=2", { stateKey: "filter[city]=MELAKA", data: PREFETCHED });

		expect(lastQuery().options?.initialData).toBeUndefined();
	});
});
