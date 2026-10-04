// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { AuthClientType } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "./index";

/** Answers every API call with 401 — what a guest gets from `/auth/me`. */
const fetchMock = vi.fn<typeof fetch>((): Promise<Response> =>
	Promise.resolve(new Response(JSON.stringify({ success: false }), { status: 401, headers: { "content-type": "application/json" } })),
);

function requestedPaths(): readonly string[] {
	return fetchMock.mock.calls.map(([input]): string => new URL(input instanceof Request ? input.url : String(input)).pathname);
}

function LoadingProbe(): React.JSX.Element {
	const { isLoading } = useAuth();
	return <p>{isLoading ? "loading" : "settled"}</p>;
}

/** Tests stay on the page — no redirect on 401. */
function neverRedirect(): boolean {
	return false;
}

/** The `X-Client-Type` header of every request, in order. */
function clientTypeHeaders(): readonly (string | null)[] {
	return fetchMock.mock.calls.map(([, init]): string | null => new Headers(init?.headers).get("X-Client-Type"));
}

function renderProvider(sessionHint: boolean, clientType: AuthClientType = "web"): void {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	render(
		<QueryClientProvider client={queryClient}>
			<AuthProvider clientType={clientType} sessionHint={sessionHint} shouldRedirectOnUnauthorized={neverRedirect}>
				<LoadingProbe />
			</AuthProvider>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	fetchMock.mockClear();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("AuthProvider on-mount session revalidation", () => {
	it("makes no auth request for a guest page (no session cookie on the server) and still settles", async () => {
		renderProvider(false);

		await waitFor(() => {
			expect(screen.getByText("settled")).toBeDefined();
		});
		expect(requestedPaths().filter((path: string): boolean => path.includes("/auth/"))).toEqual([]);
	});

	it("revalidates /auth/me and /auth/permissions when the server saw a session", async () => {
		renderProvider(true);

		await waitFor(() => {
			expect(screen.getByText("settled")).toBeDefined();
		});
		expect(requestedPaths().some((path: string): boolean => path.endsWith("/auth/me"))).toBe(true);
		expect(requestedPaths().some((path: string): boolean => path.endsWith("/auth/permissions"))).toBe(true);
	});

	it.each<AuthClientType>(["web", "admin", "merchant"])("sends X-Client-Type: %s on every session request", async (clientType: AuthClientType) => {
		renderProvider(true, clientType);

		await waitFor(() => {
			expect(screen.getByText("settled")).toBeDefined();
		});
		expect(fetchMock).toHaveBeenCalled();
		expect(clientTypeHeaders().every((header: string | null): boolean => header === clientType)).toBe(true);
	});
});
