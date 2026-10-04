// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type * as ServerApi from "@workspace/client/lib/api/server-api";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ClaimQrViewProps } from "@/components/rewardhub/claims/qr-view";
import { loginPath, walletClaimPath } from "@/lib/routes";
import { pageExit } from "@/test-support/navigation";
import { failedQuery, httpFailure } from "@/test-support/server-query";

import WalletClaimPage from "../page";
import { testEnvelope } from "@/test-support/envelope";

const { qrQuery, guardWebPage, qrView } = vi.hoisted(() => ({
	qrQuery: vi.fn(),
	guardWebPage: vi.fn<(returnPath: string) => Promise<void>>(),
	qrView: vi.fn<(props: ClaimQrViewProps) => React.JSX.Element>(),
}));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ claims: { qr: { query: qrQuery } } }) }));
vi.mock("@/lib/auth/page-guard", () => ({ guardWebPage }));
vi.mock("@/components/rewardhub/claims/qr-view", () => ({ ClaimQrView: qrView }));
vi.mock("@/components/auth/access-gate", () => ({ AccessGate: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</> }));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});
vi.mock("next/navigation", async (importOriginal) => {
	const { withNavigationSignals } = await import("@/test-support/navigation");
	return withNavigationSignals(await importOriginal<typeof import("next/navigation")>());
});

const CLAIM_ID = "00000000-0000-4000-8000-0000000000c1";
/** The page only forwards the QR payload, so an opaque marker stands in for it. */
const QR = { marker: "qr" };

async function renderPage(claimId: string = CLAIM_ID): Promise<void> {
	render(await WalletClaimPage({ params: Promise.resolve({ claimId }) }));
}

beforeEach((): void => {
	guardWebPage.mockResolvedValue(undefined);
	qrView.mockReturnValue(<p>qr</p>);
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
	it("guards the page with the claim's own path, then hands the QR to the view", async () => {
		qrQuery.mockResolvedValue(testEnvelope(QR));

		await renderPage();

		expect(guardWebPage).toHaveBeenCalledWith(walletClaimPath(CLAIM_ID));
		expect(qrQuery).toHaveBeenCalledWith({ claimId: CLAIM_ID });
		expect(qrView.mock.lastCall?.[0]).toEqual({ claimId: CLAIM_ID, initialQr: testEnvelope(QR) });
	});

	it("renders not-found for a malformed claim id without calling the API", async () => {
		await expect(pageExit(() => renderPage("not-a-uuid"))).resolves.toEqual({ kind: "not-found" });
		expect(qrQuery).not.toHaveBeenCalled();
	});

	it("renders not-found when the API has no such claim for this user (404)", async () => {
		qrQuery.mockImplementation(() => failedQuery(httpFailure(404)));

		await expect(pageExit(renderPage)).resolves.toEqual({ kind: "not-found" });
	});

	it("sends a rejected session (401) to sign-in, returning to this claim", async () => {
		qrQuery.mockImplementation(() => failedQuery(httpFailure(401)));

		await expect(pageExit(renderPage)).resolves.toEqual({ kind: "redirect", url: loginPath(walletClaimPath(CLAIM_ID)) });
	});

	it("renders the access notice on 403", async () => {
		qrQuery.mockImplementation(() => failedQuery(httpFailure(403)));

		await renderPage();

		expect(screen.getByRole("heading", { name: "Not available for your account" })).toBeTruthy();
	});

	it("rethrows a timeout to the error boundary instead of rendering an empty QR page", async () => {
		qrQuery.mockImplementation(() => failedQuery({ kind: "timeout" }));

		await expect(renderPage()).rejects.toThrow("claims.qr failed during server render: timed out");
		expect(qrView).not.toHaveBeenCalled();
	});
});
