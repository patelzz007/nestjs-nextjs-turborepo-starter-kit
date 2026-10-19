// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { Envelope, RewardClaimResponse, RewardClaimStatus } from "@workspace/shared";
import type * as ServerApi from "@workspace/client/lib/api/server-api";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLAIM_QR_LOADING_LABELS } from "@/components/loading/loading-labels";
import { loginPath, walletClaimPath } from "@/lib/routes";
import { buildRewardClaimResponse } from "@/test-support/claim";
import { testEnvelope } from "@/test-support/envelope";
import { pageExit } from "@/test-support/navigation";
import { failedQuery, httpFailure } from "@/test-support/server-query";

import WalletClaimPage from "../page";

/** What the view passes as `claims.get` query options: the envelope the server prefetched. */
interface ClaimQueryOptionsStub {
	readonly initialData?: Envelope<RewardClaimResponse>;
}

const { claimGetQuery, claimQrServerCall, guardWebPage, issueCodes } = vi.hoisted(() => ({
	claimGetQuery: vi.fn(),
	/** `claims.qr` on the server caller — a server render must never reach it. */
	claimQrServerCall: vi.fn(),
	guardWebPage: vi.fn<(returnPath: string) => Promise<void>>(),
	/** The browser-side `claims.qr` mutation the view issues after mount. */
	issueCodes: vi.fn<(input: { readonly claimId: string }) => void>(),
}));

vi.mock("@/lib/web-server-api", () => ({
	createWebServerCaller: (): object => ({ claims: { get: { query: claimGetQuery }, qr: { query: claimQrServerCall, mutate: claimQrServerCall } } }),
}));
vi.mock("@/contexts/identity/lib/page-guard", () => ({ guardWebPage }));
vi.mock("@/contexts/identity/components/access-gate", () => ({ AccessGate: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</> }));
// The view's client hooks: `claims.get` answers with the prefetched envelope (as TanStack's
// `initialData` does), `claims.qr` records every issue so a server render can prove it issued none.
vi.mock("@workspace/client/lib/contexts/identity", () => ({
	useAuth: (): object => ({
		api: {
			claims: {
				get: { useQuery: (_input: { readonly claimId: string }, options: ClaimQueryOptionsStub): object => ({ data: options.initialData, isLoading: false }) },
				qr: { useMutation: (): object => ({ mutate: issueCodes, data: undefined, isPending: false, isError: false }) },
			},
		},
	}),
}));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});
vi.mock("next/navigation", async (importOriginal) => {
	const { withNavigationSignals } = await import("@/test-support/navigation");
	return withNavigationSignals(await importOriginal<typeof import("next/navigation")>());
});

const CLAIM_ID = "00000000-0000-4000-8000-0000000000c1";
const REWARD_TITLE = "Free flat white";

function claimEnvelope(status: RewardClaimStatus = "PENDING"): Envelope<RewardClaimResponse> {
	return testEnvelope(buildRewardClaimResponse({ id: CLAIM_ID, rewardTitle: REWARD_TITLE, status }));
}

async function renderPage(claimId: string = CLAIM_ID): Promise<void> {
	render(await WalletClaimPage({ params: Promise.resolve({ claimId }) }));
}

/** The page as the server streams it: rendered to HTML, so no effect (and no browser-side mutation) runs. */
async function renderPageHtml(claimId: string = CLAIM_ID): Promise<string> {
	const page = await WalletClaimPage({ params: Promise.resolve({ claimId }) });
	return renderToString(<UiKitTestProviders>{page}</UiKitTestProviders>);
}

beforeEach((): void => {
	guardWebPage.mockResolvedValue(undefined);
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged
	});
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("WalletClaimPage (server)", () => {
	it("guards the page with the claim's own path, then prefetches the claim with claims.get", async () => {
		claimGetQuery.mockResolvedValue(claimEnvelope());

		await renderPageHtml();

		expect(guardWebPage).toHaveBeenCalledWith(walletClaimPath(CLAIM_ID));
		expect(claimGetQuery).toHaveBeenCalledWith({ claimId: CLAIM_ID });
	});

	it("server-renders the claim card and a QR-sized skeleton into the HTML", async () => {
		claimGetQuery.mockResolvedValue(claimEnvelope());

		const html = await renderPageHtml();

		expect(html).toContain(REWARD_TITLE);
		expect(html).toContain("Show at checkout");
		expect(html).toContain(CLAIM_QR_LOADING_LABELS.loading);
	});

	it("never issues QR codes during a server render", async () => {
		claimGetQuery.mockResolvedValue(claimEnvelope());

		await renderPageHtml();

		expect(claimQrServerCall).not.toHaveBeenCalled();
		expect(issueCodes).not.toHaveBeenCalled();
	});

	it("renders not-found for a malformed claim id without calling the API", async () => {
		await expect(pageExit(() => renderPage("not-a-uuid"))).resolves.toEqual({ kind: "not-found" });
		expect(claimGetQuery).not.toHaveBeenCalled();
	});

	it("renders not-found when the API has no such claim for this user (404)", async () => {
		claimGetQuery.mockImplementation(() => failedQuery(httpFailure(404)));

		await expect(pageExit(renderPage)).resolves.toEqual({ kind: "not-found" });
	});

	it("sends a rejected session (401) to sign-in, returning to this claim", async () => {
		claimGetQuery.mockImplementation(() => failedQuery(httpFailure(401)));

		await expect(pageExit(renderPage)).resolves.toEqual({ kind: "redirect", url: loginPath(walletClaimPath(CLAIM_ID)) });
	});

	it("renders the access notice on 403", async () => {
		claimGetQuery.mockImplementation(() => failedQuery(httpFailure(403)));

		await renderPage();

		expect(screen.getByRole("heading", { name: "Not available for your account" })).toBeTruthy();
	});

	it("rethrows a timeout to the error boundary instead of rendering an empty QR page", async () => {
		claimGetQuery.mockImplementation(() => failedQuery({ kind: "timeout" }));

		await expect(renderPage()).rejects.toThrow("claims.get failed during server render: timed out");
		expect(claimQrServerCall).not.toHaveBeenCalled();
	});
});
