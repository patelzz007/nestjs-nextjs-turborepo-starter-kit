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

vi.mock("@/lib/web-server-api", () => ({ createWebServerCaller: (): object => ({ claims: { analyticsDashboard: { query: analyticsQuery } } }) }));
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

/** 5 Oct 2026 12:00 UTC — the request time the page resolves the range against. */
const NOW_MS = Date.UTC(2026, 9, 5, 12);

async function renderPage(query: Record<string, string> = {}): Promise<void> {
	render(await RewardHubActivityPage({ searchParams: Promise.resolve(query) }));
}

beforeEach((): void => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW_MS);
	guardWebPage.mockResolvedValue(undefined);
	analyticsView.mockReturnValue(<p>activity</p>);
	vi.spyOn(console, "error").mockImplementation((): void => {
		// unexpected failures are logged
	});
});

afterEach((): void => {
	vi.useRealTimers();
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

	it("prefetches the last 30 UTC days by default and hands the answer, keyed by its request, to the view", async () => {
		analyticsQuery.mockResolvedValue(testEnvelope(ANALYTICS));

		await renderPage();

		const from = Date.UTC(2026, 8, 6);
		const to = Date.UTC(2026, 9, 6);
		expect(analyticsQuery).toHaveBeenCalledWith({ from, to, interval: "day" });
		expect(analyticsView.mock.lastCall?.[0]).toEqual({
			nowMs: NOW_MS,
			initialDashboard: { stateKey: `${String(from)}|${String(to)}|day|`, data: testEnvelope(ANALYTICS) },
		});
	});

	it("prefetches the range a shared link asks for", async () => {
		analyticsQuery.mockResolvedValue(testEnvelope(ANALYTICS));

		await renderPage({ range: "custom", from: "2026-01-01", to: "2026-06-30" });

		expect(analyticsQuery).toHaveBeenCalledWith({ from: Date.UTC(2026, 0, 1), to: Date.UTC(2026, 6, 1), interval: "week" });
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

		await expect(renderPage()).rejects.toThrow("claims.analyticsDashboard failed during server render: HTTP 500");
		expect(analyticsView).not.toHaveBeenCalled();
	});
});
