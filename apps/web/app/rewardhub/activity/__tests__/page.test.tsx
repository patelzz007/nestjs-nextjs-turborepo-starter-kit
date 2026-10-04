// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type * as ServerApi from "@workspace/client/lib/api/server-api";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RewardHubAnalyticsPageViewProps } from "@/components/rewardhub/shared/analytics-page-view";
import { loginPath, ROUTES } from "@/lib/routes";
import { pageExit } from "@/test-support/navigation";
import { failedQuery, httpFailure } from "@/test-support/server-query";

import RewardHubActivityPage from "../page";
import { testEnvelope } from "@/test-support/envelope";

const { analyticsQuery, guardWebPage, analyticsView } = vi.hoisted(() => ({
	analyticsQuery: vi.fn(),
	guardWebPage: vi.fn<(returnPath: string) => Promise<void>>(),
	analyticsView: vi.fn<(props: RewardHubAnalyticsPageViewProps) => React.JSX.Element>(),
}));

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ claims: { analytics: { query: analyticsQuery } } }) }));
vi.mock("@/lib/auth/page-guard", () => ({ guardWebPage }));
vi.mock("@/components/rewardhub/shared/analytics-page-view", () => ({ RewardHubAnalyticsPageView: analyticsView }));
vi.mock("@/components/auth/access-gate", () => ({ AccessGate: ({ children }: { readonly children: React.ReactNode }): React.JSX.Element => <>{children}</> }));
vi.mock("@workspace/client/lib/api/server-api", async (importOriginal) => {
	const { withTestFailureClassifier } = await import("@/test-support/server-query");
	return withTestFailureClassifier(await importOriginal<typeof ServerApi>());
});
vi.mock("next/navigation", async (importOriginal) => {
	const { withNavigationSignals } = await import("@/test-support/navigation");
	return withNavigationSignals(await importOriginal<typeof import("next/navigation")>());
});

/** The page only forwards the analytics payload, so an opaque marker stands in for it. */
const ANALYTICS = { marker: "user-analytics" };

async function renderPage(): Promise<void> {
	render(await RewardHubActivityPage());
}

beforeEach((): void => {
	guardWebPage.mockResolvedValue(undefined);
	analyticsView.mockReturnValue(<p>activity</p>);
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged
	});
});

afterEach((): void => {
	cleanup();
	vi.resetAllMocks();
	vi.restoreAllMocks();
});

describe("RewardHubActivityPage (server)", () => {
	it("guards the page with its own path as the return path", async () => {
		analyticsQuery.mockResolvedValue(testEnvelope(ANALYTICS));

		await renderPage();

		expect(guardWebPage).toHaveBeenCalledWith(ROUTES.rewardHub.activity);
	});

	it("hands the prefetched analytics to the view", async () => {
		analyticsQuery.mockResolvedValue(testEnvelope(ANALYTICS));

		await renderPage();

		expect(analyticsView.mock.lastCall?.[0]).toEqual({ initialAnalytics: testEnvelope(ANALYTICS) });
	});

	it("sends a rejected session (401) to sign-in", async () => {
		analyticsQuery.mockImplementation(() => failedQuery(httpFailure(401)));

		await expect(pageExit(renderPage)).resolves.toEqual({ kind: "redirect", url: loginPath(ROUTES.rewardHub.activity) });
	});

	it("renders the access notice on 403", async () => {
		analyticsQuery.mockImplementation(() => failedQuery(httpFailure(403)));

		await renderPage();

		expect(screen.getByRole("heading", { name: "Not available for your account" })).toBeTruthy();
		expect(analyticsView).not.toHaveBeenCalled();
	});

	it("rethrows a server error to the error boundary instead of rendering empty analytics", async () => {
		analyticsQuery.mockImplementation(() => failedQuery(httpFailure(500)));

		await expect(renderPage()).rejects.toThrow("claims.analytics failed during server render: HTTP 500");
		expect(analyticsView).not.toHaveBeenCalled();
	});
});
