// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import type { apiRouter } from "@workspace/client/lib/api/endpoints";
import type { Envelope, RewardClaimResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyClaimsPageView } from "@/components/rewardhub/claims/my-claims-page-view";
import { WALLET_CLAIMS_PAGE_SIZE } from "@/lib/url-state/wallet-claims";
import { buildRewardClaimResponse, claimsPageEnvelope } from "@/test-support/claim";

type ClaimsPage = Envelope<RewardClaimResponse[]>;
type ClaimsListInput = Parameters<typeof apiRouter.claims.list.queryKey>[0];

interface ClaimsListOptions {
	readonly initialData?: ClaimsPage;
}

interface ClaimsQueryState {
	readonly data: ClaimsPage | undefined;
	readonly isLoading: boolean;
	readonly isError: boolean;
	readonly refetch: () => Promise<void>;
}

const { claimsListQuery, refetch } = vi.hoisted(() => ({
	claimsListQuery: vi.fn<(input: ClaimsListInput, options?: ClaimsListOptions) => ClaimsQueryState>(),
	refetch: vi.fn<() => Promise<void>>(),
}));

vi.mock("@workspace/client/lib/auth", () => ({
	useAuth: (): object => ({ api: { claims: { list: { useQuery: claimsListQuery } } } }),
}));

// The wallet reads its page from the address bar, as Next.js's `useSearchParams` does.
vi.mock("next/navigation", async (importOriginal) => {
	const actual = await importOriginal<typeof import("next/navigation")>();
	return { ...actual, useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search) };
});

const PATH = "/rewardhub/wallet";
const NEXT_CURSOR = "claims-after-page-1";
const TOTAL_CLAIMS = 45;
const READY_TO_REDEEM = 7;

/** One claim on screen — far fewer than the account holds. */
const PAGE_ONE: ClaimsPage = claimsPageEnvelope({
	claims: [buildRewardClaimResponse({ rewardTitle: "Free latte", status: "REDEEMED" })],
	total: TOTAL_CLAIMS,
	limit: WALLET_CLAIMS_PAGE_SIZE,
	nextCursor: NEXT_CURSOR,
});
const READY_COUNT: ClaimsPage = claimsPageEnvelope({ claims: [buildRewardClaimResponse()], total: READY_TO_REDEEM, limit: 1 });

function isCountQuery(input: ClaimsListInput): boolean {
	return input.filter?.status !== undefined;
}

function answer(page: ClaimsQueryState, readyCount: ClaimsQueryState): void {
	claimsListQuery.mockImplementation((input: ClaimsListInput): ClaimsQueryState => (isCountQuery(input) ? readyCount : page));
}

function loaded(data: ClaimsPage): ClaimsQueryState {
	return { data, isLoading: false, isError: false, refetch };
}

function statValue(label: string): string | null | undefined {
	return screen.getByText(label).nextElementSibling?.textContent;
}

function renderAt(query: string): void {
	window.history.replaceState(null, "", `${PATH}${query}`);
	render(<MyClaimsPageView initialPage={{ stateKey: "", data: PAGE_ONE }} initialReadyCount={READY_COUNT} />);
}

beforeEach((): void => {
	refetch.mockResolvedValue(undefined);
	answer(loaded(PAGE_ONE), loaded(READY_COUNT));
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
	window.history.replaceState(null, "", "/");
});

describe("MyClaimsPageView", () => {
	it("shows the server's account-wide counts, not a count of the page on screen", () => {
		renderAt("");

		expect(statValue("Total claims")).toBe(String(TOTAL_CLAIMS));
		expect(statValue("Ready to redeem")).toBe(String(READY_TO_REDEEM));
	});

	it("queries the URL's page and seeds only the matching state with the server's page", () => {
		renderAt("");

		const pageCall = claimsListQuery.mock.calls.find(([input]) => !isCountQuery(input));
		expect(pageCall?.[LIST_SLOT_INDEX.first]).toEqual({ page: 1, limit: WALLET_CLAIMS_PAGE_SIZE });
		expect(pageCall?.[LIST_SLOT_INDEX.second]?.initialData).toBe(PAGE_ONE);

		cleanup();
		claimsListQuery.mockClear();
		renderAt("?page=2");
		const secondPageCall = claimsListQuery.mock.calls.find(([input]) => !isCountQuery(input));
		expect(secondPageCall?.[LIST_SLOT_INDEX.first]).toEqual({ page: 2, limit: WALLET_CLAIMS_PAGE_SIZE });
		expect(secondPageCall?.[LIST_SLOT_INDEX.second]?.initialData).toBeUndefined();
	});

	it("pages forward with the response's keyset cursor", () => {
		renderAt("");

		fireEvent.click(screen.getByRole("button", { name: "Next" }));

		expect(window.location.search).toBe(`?page=2&cursor=${NEXT_CURSOR}`);
	});

	it("shows a placeholder, never a guess, while a count is still loading", () => {
		answer(loaded(PAGE_ONE), { data: undefined, isLoading: true, isError: false, refetch });
		renderAt("");

		expect(statValue("Ready to redeem")).toBe("—");
	});

	it("shows a distinct error state with a retry when the claims cannot be loaded", () => {
		answer({ data: undefined, isLoading: false, isError: true, refetch }, loaded(READY_COUNT));
		renderAt("");

		expect(screen.getByRole("heading", { name: "Couldn't load your claims" })).toBeTruthy();
		expect(screen.queryByText("No claims yet")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(refetch).toHaveBeenCalledTimes(1);
	});

	it("shows the empty state only for an account with no claims", () => {
		const empty = claimsPageEnvelope({ claims: [], total: 0, limit: WALLET_CLAIMS_PAGE_SIZE });
		answer(loaded(empty), loaded(claimsPageEnvelope({ claims: [], total: 0, limit: 1 })));
		renderAt("");

		expect(screen.getByRole("heading", { name: "No claims yet" })).toBeTruthy();
	});
});
