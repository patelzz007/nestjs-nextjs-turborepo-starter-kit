// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { epochMs, type DataValue } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelopeFixture, sessionPermissionsFixture, userFixture } from "../../../test/auth-fixtures";
import { AuthProvider, type AuthProviderProps } from "../../features/auth/facade";
import { SESSION_CHECK_MAX_RETRIES, sessionCheckRetryDelayMs } from "./session-check";
import { SessionCheckNotice } from "./session-check-notice";

const LOWEST_RANDOM = 0;
const UNAVAILABLE_STATUS = 503;
const SESSION_READ_REQUESTS = 2;
const RETRY_DELAYS_MS: readonly number[] = Array.from(Array(SESSION_CHECK_MAX_RETRIES).keys(), (index: number): number =>
	sessionCheckRetryDelayMs(index + 1, (): number => LOWEST_RANDOM),
);

/** Answers are stamped with the (fake) time they are given, as the API's interceptor does — so seeded queries start fresh. */
function jsonResponse(body: DataValue, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Whether the API answers; `/auth/me` and `/auth/permissions` follow it. */
let apiIsUp: boolean;

const fetchMock = vi.fn<typeof fetch>((input: string | URL | Request): Promise<Response> => {
	const pathname = new URL(input instanceof Request ? input.url : String(input)).pathname;
	if (!apiIsUp) {
		return Promise.resolve(jsonResponse({ success: false }, UNAVAILABLE_STATUS));
	}
	const data: DataValue = pathname.endsWith("/auth/permissions") ? sessionPermissionsFixture() : userFixture();
	return Promise.resolve(jsonResponse(envelopeFixture(data, { correlationId: "corr-test", timestamp: epochMs(Date.now()) }), 200));
});

function renderNotice(options: Omit<AuthProviderProps, "children" | "clientType">): void {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={queryClient}>
			<AuthProvider clientType="web" {...options}>
				<SessionCheckNotice />
			</AuthProvider>
		</QueryClientProvider>,
	);
}

async function settle(ms = 0): Promise<void> {
	await act(async (): Promise<void> => {
		await vi.advanceTimersByTimeAsync(ms);
	});
}

function liveRegion(): HTMLElement {
	return screen.getByRole("status");
}

beforeEach((): void => {
	apiIsUp = true;
	vi.useFakeTimers();
	vi.spyOn(Math, "random").mockReturnValue(LOWEST_RANDOM);
	vi.stubGlobal("fetch", fetchMock);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	fetchMock.mockClear();
	vi.useRealTimers();
});

describe("SessionCheckNotice", () => {
	it("renders an empty polite live region while the session check is healthy", async () => {
		renderNotice({ sessionHint: true });
		await settle();

		expect(liveRegion()).toHaveProperty("textContent", "");
		expect(liveRegion().getAttribute("aria-live")).toBe("polite");
	});

	it("renders nothing for a guest, whose session is never checked", async () => {
		apiIsUp = false;
		renderNotice({ sessionHint: false });
		await settle();

		expect(liveRegion()).toHaveProperty("textContent", "");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("says it is retrying — without a button — while the API is unreachable", async () => {
		apiIsUp = false;
		renderNotice({ sessionHint: true });
		await settle();

		expect(liveRegion().textContent).toContain("Can't reach the server — retrying…");
		expect(liveRegion().textContent).toContain("This won't sign you out.");
		expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
	});

	it('offers "Try again" once the retries are spent, and the check recovers through it', async () => {
		apiIsUp = false;
		renderNotice({ sessionHint: true });
		await settle();
		for (const delay of RETRY_DELAYS_MS) {
			await settle(delay);
		}
		const button = screen.getByRole("button", { name: "Try again" });
		expect(liveRegion().textContent).toContain("We'll try again when your connection is back");
		const checksBefore = fetchMock.mock.calls.length;

		apiIsUp = true;
		fireEvent.click(button);
		await settle();

		// One session read: `/auth/me` + `/auth/permissions`.
		expect(fetchMock.mock.calls.length).toBe(checksBefore + SESSION_READ_REQUESTS);
		expect(liveRegion()).toHaveProperty("textContent", "");
	});
});
