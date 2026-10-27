// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { flushUrlUpdates } from "@workspace/client/testing/flush-url-updates";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantRedemptionsPageView } from "@/contexts/pos/components/redemptions/merchant-redemptions-page-view";
import { MERCHANT_REDEMPTIONS_PAGE_SIZE } from "@/contexts/pos/lib/redemptions/redemptions-page";
import type { DayWindow } from "@/contexts/pos/lib/redemptions/today-window";
import { renderWithAuthorization, TEST_ORG_SLUG } from "@/test/authorization";
import { contextQueryState, twoStoreSeed, TWO_STORE_CONTEXT, type ContextQueryState } from "@/test/tenant-context";
import { STORE_A, TERMINAL_FIXTURE_NOW } from "@/test/terminals";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { testEnvelope } from "@/test/envelope";
import { ApiPaginatedMetaSchema, MerchantRedemptionListItemSchema, type ApiPaginatedMeta, type Envelope, type MerchantRedemptionListItem } from "@workspace/shared";
import { MERCHANT_REDEMPTIONS_LOADING_LABELS, REDEMPTION_SKELETON_ROWS, REDEMPTION_STAT_CARDS } from "@/components/loading/merchant-page-skeletons";
import { busyRegionAnnouncements } from "@/test/skeleton";

type RedemptionsInput = Parameters<typeof apiRouter.tenants.redemptions.queryKey>[0];

interface RedemptionsQueryOptions {
	readonly initialData?: Envelope<MerchantRedemptionListItem[]>;
}

const { redemptionsQuery, contextQuery, banCustomer } = vi.hoisted(() => ({
	redemptionsQuery: vi.fn<(input: RedemptionsInput, options?: RedemptionsQueryOptions) => object>(),
	contextQuery: vi.fn<() => ContextQueryState>(),
	banCustomer: vi.fn<(input: object) => void>(),
}));

vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			tenants: {
				redemptions: { useQuery: redemptionsQuery },
				context: { useQuery: contextQuery },
				banCustomer: { useMutation: (): object => ({ mutate: banCustomer, isPending: false }) },
			},
		},
	}),
}));

const PATH = `/t/${TEST_ORG_SLUG}/redemptions`;
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
	customerBanned: false,
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
	banCustomer.mockReset();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

describe("MerchantRedemptionsPageView authorization", () => {
	it("renders the redemption log with merchant:view_redemptions", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("No redemptions yet")).toBeTruthy();
	});

	it("denies the page and skips the redemptions query without the capability", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "MEMBER" });

		expect(screen.getByText("You don't have access to this page")).toBeTruthy();
		expect(redemptionsQuery).not.toHaveBeenCalled();
	});

	it("renders the loading state while the membership resolves", () => {
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { isLoading: true });

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REDEMPTIONS_LOADING_LABELS.loading]);
	});
});

describe("MerchantRedemptionsPageView loading", () => {
	it("draws the stat cards and redemption rows — never a count of zero — while the first page loads", () => {
		redemptionsQuery.mockReturnValue({ data: undefined, isLoading: true });
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(busyRegionAnnouncements()).toEqual([MERCHANT_REDEMPTIONS_LOADING_LABELS.loading]);
		expect(document.querySelectorAll('[data-slot="merchant-bordered-row-skeleton"]')).toHaveLength(REDEMPTION_SKELETON_ROWS);
		expect(document.querySelectorAll('[data-slot="merchant-stat-card-skeleton"]')).toHaveLength(REDEMPTION_STAT_CARDS);
		expect(screen.queryByText("Showing")).toBeNull();
		expect(screen.queryByText("No redemptions yet")).toBeNull();
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
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(lastInput()).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 3, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, locationId: STORE_A.id });
	});

	it("pushes the next page with the response's keyset cursor, and the previous page by offset", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		redemptionsQuery.mockReturnValue({ data: envelope(1, 3), isLoading: false });
		const view = renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("Page 1 of 3")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		await flushUrlUpdates();
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(window.location.search).toBe(`?page=2&cursor=${NEXT_CURSOR}`);

		redemptionsQuery.mockReturnValue({ data: envelope(2, 3), isLoading: false });
		view.rerender(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />);
		expect(lastInput()).toEqual({ tenantSlug: TEST_ORG_SLUG, page: 2, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, cursor: NEXT_CURSOR, locationId: undefined });
		fireEvent.click(screen.getByRole("button", { name: "Previous" }));
		await flushUrlUpdates();
		expect(window.location.search).toBe("");
	});

	it("follows the URL on back/forward", () => {
		window.history.replaceState(null, "", `${PATH}?page=2`);
		const view = renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		act((): void => {
			window.history.replaceState(null, "", PATH);
		});
		view.rerender(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />);

		expect(lastInput()?.page).toBe(1);
	});

	it("offers a way back to the latest redemptions from a page past the end", async () => {
		window.history.replaceState(null, "", `${PATH}?page=9`);
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("No redemptions on this page")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Go to the latest redemptions" }));
		await flushUrlUpdates();
		expect(window.location.search).toBe("");
	});

	it("hides the pager when the log fits on one page", () => {
		redemptionsQuery.mockReturnValue({ data: envelope(1, 1), isLoading: false });
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

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
				tenantSlug={TEST_ORG_SLUG}
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
		expect(input === undefined ? [] : apiRouter.tenants.redemptions.queryKey(input)).toEqual(
			apiRouter.tenants.redemptions.queryKey({ tenantSlug: TEST_ORG_SLUG, page: 1, limit: MERCHANT_REDEMPTIONS_PAGE_SIZE, locationId: STORE_A.id }),
		);
		expect(options?.initialData?.data).toEqual([LATTE_REDEMPTION]);
	});

	it("never caches another store's rows under the client's key — the query fetches instead", () => {
		renderWithAuthorization(
			<MerchantRedemptionsPageView
				tenantSlug={TEST_ORG_SLUG}
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
				tenantSlug={TEST_ORG_SLUG}
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
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER", tenantContext: twoStoreSeed(STORE_A.id) });

		expect(screen.getByText("Today").parentElement?.textContent).toContain("57");
		expect(redemptionsQuery).toHaveBeenCalledWith(
			{ tenantSlug: TEST_ORG_SLUG, page: 1, limit: 1, locationId: STORE_A.id, filter: { redeemedAt: { gte: TODAY.fromMs, lt: TODAY.toMs } } },
			expect.anything(),
		);
	});

	it("shows no number until the count arrives, and says when it failed", () => {
		redemptionsQuery.mockImplementation((input: RedemptionsInput): object =>
			isDayCountInput(input) ? { data: undefined, isLoading: false, isError: true } : { data: envelope(1, 1), isLoading: false, isError: false },
		);
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		const card = screen.getByText("Today").parentElement;
		expect(card?.textContent).toContain("—");
		expect(card?.textContent).toContain("Couldn't load today's count");
	});
});

describe("MerchantRedemptionsPageView customer bans", () => {
	function showRows(rows: readonly MerchantRedemptionListItem[]): void {
		redemptionsQuery.mockReturnValue({ data: testEnvelope([...rows], paginatedMeta(1, 1)), isLoading: false });
	}

	it("lets a member who manages rewards ban the customer behind a redemption, with the trimmed reason", () => {
		showRows([LATTE_REDEMPTION]);
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "OWNER" });

		fireEvent.click(screen.getByRole("button", { name: "Ban this customer" }));
		const confirm = screen.getByRole("button", { name: "Ban customer" });
		expect(confirm.hasAttribute("disabled")).toBe(true);
		fireEvent.change(screen.getByLabelText(/Why is this customer banned/), { target: { value: "  Screenshot of a used voucher  " } });
		fireEvent.click(confirm);

		expect(banCustomer).toHaveBeenCalledWith({ tenantSlug: TEST_ORG_SLUG, redemptionId: LATTE_REDEMPTION.redemptionId, reason: "Screenshot of a used voucher" });
	});

	it("marks a banned customer's redemption, offering no second ban", () => {
		showRows([{ ...LATTE_REDEMPTION, customerBanned: true }]);
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "OWNER" });

		expect(screen.getByText("Customer banned")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Ban this customer" })).toBeNull();
	});

	it("offers no ban to a cashier, who cannot manage rewards", () => {
		showRows([LATTE_REDEMPTION]);
		renderWithAuthorization(<MerchantRedemptionsPageView tenantSlug={TEST_ORG_SLUG} today={TODAY} />, { role: "CASHIER" });

		expect(screen.getByText("Free latte")).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Ban this customer" })).toBeNull();
	});
});
