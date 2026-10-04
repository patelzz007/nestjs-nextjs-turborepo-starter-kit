// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type * as ServerApi from "@workspace/client/lib/api/server-api";
import type { Envelope, RewardClaimListQuery, RewardClaimResponse } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MyClaimsPageViewProps } from "@/components/rewardhub/claims/my-claims-page-view";
import { loginPath, ROUTES } from "@/lib/routes";
import { WALLET_CLAIMS_PAGE_SIZE, WALLET_CLAIMS_URL_STATE } from "@/lib/url-state/wallet-claims";
import { buildRewardClaimResponse, claimsPageEnvelope } from "@/test-support/claim";
import { RedirectSignal } from "@/test-support/navigation";
import { failedQuery, httpFailure } from "@/test-support/server-query";

import RewardHubWalletPage from "../page";

type ClaimsPage = Envelope<RewardClaimResponse[]>;

const { claimsList, guardWebPage, walletView } = vi.hoisted(() => ({
	claimsList: vi.fn<(input: RewardClaimListQuery) => Promise<ClaimsPage>>(),
	guardWebPage: vi.fn<(returnPath: string) => Promise<void>>(),
	walletView: vi.fn<(props: MyClaimsPageViewProps) => React.JSX.Element>(),
}));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ claims: { list: { query: claimsList } } }) }));
vi.mock("@/lib/auth/page-guard", () => ({ guardWebPage }));
// The client view and the client-side gate are probes: this suite checks what the server hands them.
vi.mock("@/components/rewardhub/claims/my-claims-page-view", () => ({ MyClaimsPageView: walletView }));
vi.mock("@/components/auth/access-gate", () => ({ AccessGate: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</> }));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});
vi.mock("next/navigation", async (importOriginal) => {
	const { withNavigationSignals } = await import("@/test-support/navigation");
	return withNavigationSignals(await importOriginal<typeof import("next/navigation")>());
});

const TOTAL_CLAIMS = 45;
const READY_TO_REDEEM = 7;
const PAGE_ONE: ClaimsPage = claimsPageEnvelope({ claims: [buildRewardClaimResponse()], total: TOTAL_CLAIMS, limit: WALLET_CLAIMS_PAGE_SIZE });
const READY_COUNT: ClaimsPage = claimsPageEnvelope({ claims: [buildRewardClaimResponse()], total: READY_TO_REDEEM, limit: 1 });

/** The page list query answers with `page`, the ready-to-redeem count query with `readyCount`. */
function apiAnswers(page: () => Promise<ClaimsPage>, readyCount: () => Promise<ClaimsPage>): void {
	claimsList.mockImplementation((input: RewardClaimListQuery): Promise<ClaimsPage> => (input.filter?.status === undefined ? page() : readyCount()));
}

async function renderPage(query = ""): Promise<void> {
	render(await RewardHubWalletPage({ searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(query))) }));
}

async function pageRedirect(): Promise<string | undefined> {
	try {
		await renderPage();
		return undefined;
	} catch (error: unknown) {
		if (error instanceof RedirectSignal) {
			return error.url;
		}
		throw error;
	}
}

beforeEach((): void => {
	guardWebPage.mockResolvedValue(undefined);
	walletView.mockReturnValue(<p>wallet</p>);
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged; asserted where relevant
	});
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("RewardHubWalletPage (server)", () => {
	it("guards the page before fetching anything", async () => {
		guardWebPage.mockRejectedValue(new RedirectSignal(loginPath(ROUTES.rewardHub.wallet)));

		await expect(pageRedirect()).resolves.toBe(loginPath(ROUTES.rewardHub.wallet));
		expect(guardWebPage).toHaveBeenCalledWith(ROUTES.rewardHub.wallet);
		expect(claimsList).not.toHaveBeenCalled();
	});

	it("prefetches the URL's page and the account-wide ready-to-redeem count, and hands both to the view", async () => {
		apiAnswers(
			() => Promise.resolve(PAGE_ONE),
			() => Promise.resolve(READY_COUNT),
		);

		await renderPage("page=2");

		expect(claimsList).toHaveBeenCalledWith({ page: 2, limit: WALLET_CLAIMS_PAGE_SIZE });
		expect(claimsList).toHaveBeenCalledWith({ page: 1, limit: 1, filter: { status: { eq: "PENDING" } } });
		expect(walletView.mock.lastCall?.[0]).toEqual({
			initialPage: { stateKey: WALLET_CLAIMS_URL_STATE.serialize(WALLET_CLAIMS_URL_STATE.parse({ page: "2" })), data: PAGE_ONE },
			initialReadyCount: READY_COUNT,
		});
	});

	it("sends a session the API rejects (401) to sign-in, returning to the wallet", async () => {
		apiAnswers(
			() => failedQuery(httpFailure(401)),
			() => Promise.resolve(READY_COUNT),
		);

		await expect(pageRedirect()).resolves.toBe(loginPath(ROUTES.rewardHub.wallet));
		expect(walletView).not.toHaveBeenCalled();
	});

	it("renders the access notice when the API forbids the wallet (403)", async () => {
		apiAnswers(
			() => Promise.resolve(PAGE_ONE),
			() => failedQuery(httpFailure(403)),
		);

		await renderPage();

		expect(screen.getByRole("heading", { name: "Not available for your account" })).toBeTruthy();
		expect(walletView).not.toHaveBeenCalled();
	});

	it("rethrows an API outage to the error boundary instead of rendering an empty wallet", async () => {
		apiAnswers(
			() => failedQuery({ kind: "unreachable", cause: "ECONNREFUSED" }),
			() => Promise.resolve(READY_COUNT),
		);

		await expect(renderPage()).rejects.toThrow("claims.list failed during server render: network (ECONNREFUSED)");
		expect(walletView).not.toHaveBeenCalled();
	});

	it("rethrows a failed count instead of showing a made-up number", async () => {
		apiAnswers(
			() => Promise.resolve(PAGE_ONE),
			() => failedQuery(httpFailure(500)),
		);

		await expect(renderPage()).rejects.toThrow("HTTP 500");
	});
});
