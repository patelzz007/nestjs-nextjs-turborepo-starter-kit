// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRedemptionsPageView } from "@/components/redemptions/merchant-redemptions-page-view";
import { MERCHANT_REDEMPTIONS_PAGE_SIZE } from "@/lib/redemptions/redemptions-page";
import type { DayWindow } from "@/lib/redemptions/today-window";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, TERMINAL_FIXTURE_NOW } from "@/test/terminals";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { testEnvelope } from "@/test/envelope";
import { ApiPaginatedMetaSchema, MerchantRedemptionListItemSchema, type ApiPaginatedMeta, type Envelope, type MerchantRedemptionListItem } from "@workspace/shared";

type RedemptionsInput = Parameters<typeof apiRouter.organizations.redemptions.queryKey>[0];

interface RedemptionsQueryOptions {
	readonly initialData?: Envelope<MerchantRedemptionListItem[]>;
}

const { redemptionsQuery, contextQuery } = vi.hoisted(() => ({
	redemptionsQuery: vi.fn<(input: RedemptionsInput, options?: RedemptionsQueryOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({
		api: { organizations: { redemptions: { useQuery: redemptionsQuery }, context: { useQuery: contextQuery } } },
	}),
}));

// The page is read from the address bar, as Next.js's `useSearchParams` does
// once its History API integration has synced it.
vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	return { ...actual, useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search) };
});

const PATH = `/orgs/${TEST_ORG_SLUG}/redemptions`;
/** "Today" as the server decided it (2026-10-01 in the stores' zone). */
const TODAY: DayWindow = { fromMs: TERMINAL_FIXTURE_NOW - 8 * 3_600_000, toMs: TERMINAL_FIXTURE_NOW + 16 * 3_600_000 };

function isDayCountInput(input: RedemptionsInput): boolean {
	return "filter" in input && input.filter !== undefined;
}
const NEXT_CURSOR = "cursor-after-page-1";

const LATTE_REDEMPTION: MerchantRedemptionListItem = MerchantRedemptionListItemSchema.parse({
	redemptionId: "3c4d5e6f-3333-4444-8555-666677778888",
	rewardTitle: "Free latte",
	redeemedAt: TERMINAL_FIXTURE_NOW,
	terminalId: "TERM-7F3K9QX2",
	redemptionMethod: "SCAN",
});

function paginatedMeta(page: number, totalPages: number): ApiPaginatedMeta {
	return ApiPaginatedMetaSchema.parse({
		correlationId: "",
		timestamp: TERMINAL_FIXTURE_NOW,
		limit: MERCHANT_REDEMPTIONS_PAGE_SIZE,
		total: totalPages * MERCHANT_REDEMPTIONS_PAGE_SIZE,
		page,
		totalPages,
		nextCursor: page < totalPages ? NEXT_CURSOR : null,
		hasNext: page < totalPages,
		hasPrevious: page > 1,
	});
}

function envelope(page: number, totalPages: number): Envelope<MerchantRedemptionListItem[]> {
	return testEnvelope([LATTE_REDEMPTION], paginatedMeta(page, totalPages));
}

beforeEach((): void => {
	window.history.replaceState(null, "", PATH);
	redemptionsQuery.mockReturnValue({ data: { data: [] }, isLoading: false });
	contextQuery.mockReturnValue(contextQueryState(TWO_STORE_CONTEXT));
});

afterEach((): void => {
	cleanup();
	redemptionsQuery.mockReset();
	contextQuery.mockReset();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

describe("MerchantRedemptionsPageView authorization", () => {
	it("renders the redemption log with merchant:view_redemptions", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("No redemptions yet")).toBeTruthy();
	});

	it("denies the page and skips the redemptions query without the capability", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(redemptionsQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { isLoading: true });

		expect(screen.getByRole("status", { name: "Checking access" })).toBeTruthy();
	});
});

describe("MerchantRedemptionsPageView paging (URL state)", () => {
	/** The latest LIST request (the "today" count is a separate request). */
	function lastInput(): RedemptionsInput | undefined {
		const [input] = redemptionsQuery.mock.calls.filter(([candidate]) => !isDayCountInput(candidate)).at(-1) ?? [];
		return input;
	}

	it("requests the page the URL names, for the selected store", () => {
		window.history.replaceState(null, "", `${PATH}?page=3`);
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(lastInput()).toEqual({ orgSlug: TEST_ORG_SLUG, page: 3, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, locationId: STORE_A.id });
	});

	it("pushes the next page with the response's keyset cursor, and the previous page by offset", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		redemptionsQuery.mockReturnValue({ data: envelope(1, 3), isLoading: false });
		const view = renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("Page 1 of 3")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe(`?page=2&cursor=${NEXT_CURSOR}`);

		redemptionsQuery.mockReturnValue({ data: envelope(2, 3), isLoading: false });
		view.rerender(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />);
		expect(lastInput()).toEqual({ orgSlug: TEST_ORG_SLUG, page: 2, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, cursor: NEXT_CURSOR, locationId: undefined });
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		expect(window.location.search).toBe("");
	});

	it("follows the URL on back/forward", () => {
		window.history.replaceState(null, "", `${PATH}?page=2`);
		const view = renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		act((): void => {
			window.history.replaceState(null, "", PATH);
		});
		view.rerender(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />);

		expect(lastInput()?.page).toBe(1);
	});

	it("offers a way back to the latest redemptions from a page past the end", () => {
		window.history.replaceState(null, "", `${PATH}?page=9`);
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("No redemptions on this page")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Go to the latest redemptions" }));
		expect(window.location.search).toBe("");
	});

	it("hides the pager when the log fits on one page", () => {
		redemptionsQuery.mockReturnValue({ data: envelope(1, 1), isLoading: false });
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("Free latte")).toBeTruthy();
		expect(screen.queryByRole("navigation", { name: "Redemptions pages" })).toBeNull();
	});
});

describe("MerchantRedemptionsPageView server prefetch (no double fetch)", () => {
	function firstRenderQuery(): { readonly input: RedemptionsInput | undefined; readonly options: RedemptionsQueryOptions | undefined } {
		const [input, options] = redemptionsQuery.mock.calls.at(0) ?? [];
		return { input, options };
	}

	const PREFETCHED_FIRST_PAGE: Envelope<MerchantRedemptionListItem[]> = envelope(1, 1);

	it("seeds the first render with the server's rows when they were fetched for the store the client filters by", () => {
		renderWithAuthorization(
			<MerchantRedemptionsPageView
				orgSlug={TEST_ORG_SLUG}
				today={TODAY}
				initialRedemptions={{ locationId: STORE_A.id, data: { stateKey: "", data: PREFETCHED_FIRST_PAGE } }}
			/>,
			{
				role: "CASHIER",
				tenantContext: twoStoreSeed(STORE_A.id),
			},
		);

		const { input, options } = firstRenderQuery();
		expect(input?.locationId).toBe(STORE_A.id);
		expect(input === undefined ? [] : apiRouter.organizations.redemptions.queryKey(input)).toEqual(
			apiRouter.organizations.redemptions.queryKey({ orgSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, locationId: STORE_A.id }),
		);
		expect(options?.initialData?.data).toEqual([LATTE_REDEMPTION]);
	});

	it("never caches another store's rows under the client's key — the query fetches instead", () => {
		renderWithAuthorization(
			<MerchantRedemptionsPageView
				orgSlug={TEST_ORG_SLUG}
				today={TODAY}
				initialRedemptions={{ locationId: STORE_A.id, data: { stateKey: "", data: PREFETCHED_FIRST_PAGE } }}
			/>,
			{
				role: "CASHIER",
				tenantContext: twoStoreSeed(null),
			},
		);

		const { input, options } = firstRenderQuery();
		expect(input?.locationId).toBeUndefined();
		expect(options?.initialData).toBeUndefined();
	});

	it("never caches the server's page under another page's key", () => {
		window.history.replaceState(null, "", `${PATH}?page=2`);
		renderWithAuthorization(
			<MerchantRedemptionsPageView
				orgSlug={TEST_ORG_SLUG}
				today={TODAY}
				initialRedemptions={{ locationId: STORE_A.id, data: { stateKey: "", data: PREFETCHED_FIRST_PAGE } }}
			/>,
			{
				role: "CASHIER",
				tenantContext: twoStoreSeed(STORE_A.id),
			},
		);

		const { input, options } = firstRenderQuery();
		expect(input?.page).toBe(2);
		expect(options?.initialData).toBeUndefined();
	});
});

/** The API's answer to the day-count request: 57 redemptions today, one row on its page. */
const TODAY_COUNT_META: ApiPaginatedMeta = ApiPaginatedMetaSchema.parse({ ...paginatedMeta(1, 1), limit: 1, total: 57, totalPages: 57 });

describe("MerchantRedemptionsPageView today count", () => {
	it("shows the API's count of the whole day (meta.total), not the rows on the current page", () => {
		redemptionsQuery.mockImplementation((input: RedemptionsInput): object =>
			isDayCountInput(input)
				? { data: testEnvelope([LATTE_REDEMPTION], TODAY_COUNT_META), isLoading: false, isError: false }
				: { data: envelope(1, 3), isLoading: false, isError: false },
		);
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(screen.getByText("Today").parentElement?.textContent).toContain("57");
		expect(redemptionsQuery).toHaveBeenCalledWith(
			{ orgSlug: TEST_ORG_SLUG, page: 1, limit: 1, locationId: STORE_A.id, filter: { redeemedAt: { gte: TODAY.fromMs, lt: TODAY.toMs } } },
			expect.anything(),
		);
	});

	it("shows no number until the count arrives, and says when it failed", () => {
		redemptionsQuery.mockImplementation((input: RedemptionsInput): object =>
			isDayCountInput(input) ? { data: undefined, isLoading: false, isError: true } : { data: envelope(1, 1), isLoading: false, isError: false },
		);
		renderWithAuthorization(<MerchantRedemptionsPageView orgSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		const card = screen.getByText("Today").parentElement;
		expect(card?.textContent).toContain("—");
		expect(card?.textContent).toContain("Couldn't load today's count");
	});
});
