import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { proxy } from "./proxy";

// ── Mocks ──────────────────────────────────────────────────────────────────
// The proxy module imports `next/server` (NextResponse) and
// `@workspace/client/lib/api/config` (API_BASE_URL). Both are mocked below
// (vi.mock factories are hoisted above the import).

interface CookieCall {
	readonly name: string;
	readonly value: string;
	readonly options?: Record<string, unknown>;
}

class MockResponseCookies {
	public readonly calls: CookieCall[] = [];

	public set(name: string, value: string, options?: Record<string, unknown>): void {
		this.calls.push({ name, value, options });
	}
}

interface MockResponse {
	readonly status: number;
	readonly url?: string;
	readonly cookies: MockResponseCookies;
}

const nextResponse = vi.hoisted(() => {
	const createResponse = (init?: { readonly status?: number; readonly url?: string }): MockResponse => ({
		status: init?.status ?? 200,
		url: init?.url,
		cookies: new MockResponseCookies(),
	});
	return {
		next: vi.fn((): MockResponse => createResponse()),
		redirect: vi.fn((url: string | URL): MockResponse => createResponse({ status: 307, url: String(url) })),
	};
});

vi.mock("next/server", () => ({ NextResponse: nextResponse }));
vi.mock("@workspace/client/lib/api/config", () => ({ API_BASE_URL: "http://api.test" }));

// ── Request / response plumbing ─────────────────────────────────────────────

interface RequestOptions {
	readonly pathname?: string;
	readonly accessToken?: string | null;
	readonly refreshToken?: string | null;
	readonly secFetchMode?: string | null;
	readonly accept?: string | null;
	readonly query?: Record<string, string>;
}

function makeRequest(options: RequestOptions): unknown {
	const cookieValue = (name: string): { readonly value: string } | undefined => {
		const value = name === "adminAccessToken" ? options.accessToken : name === "adminRefreshToken" ? options.refreshToken : undefined;
		return value === undefined || value === null ? undefined : { value };
	};
	return {
		cookies: { get: cookieValue },
		headers: {
			get: (name: string): string | null => {
				if (name === "sec-fetch-mode") return options.secFetchMode ?? null;
				if (name === "accept") return options.accept ?? null;
				return null;
			},
		},
		nextUrl: {
			pathname: options.pathname ?? "/",
			searchParams: new URLSearchParams(options.query),
		},
		url: `http://localhost:3001${options.pathname ?? "/"}`,
	};
}

function runProxy(options: RequestOptions): Promise<MockResponse> {
	const request = makeRequest(options);
	return proxy(request as NextRequest) as unknown as Promise<MockResponse>;
}

/** The URL the proxy redirected to (normalised from the URL object it passes). */
function redirectTarget(): string {
	const call = nextResponse.redirect.mock.calls[0];
	if (call === undefined) throw new Error("redirect was never called");
	const url = call[0];
	return typeof url === "string" ? url : url.href;
}

function makeJwt(payload: Record<string, unknown>): string {
	const encode = (value: unknown): string => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

/** An expired admin token WITHOUT admin access (hasAdminAccess: false). */
function expiredNonAdminToken(): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) - 60, hasAdminAccess: false });
}

function adminToken(expInSeconds: number): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) + expInSeconds, hasAdminAccess: true });
}

function nonAdminToken(): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) + 3600, hasAdminAccess: false });
}

function stubRefreshResponse(status: number, setCookies: readonly string[]): void {
	const headers = new Headers();
	for (const header of setCookies) headers.append("set-cookie", header);
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status, headers })));
}

const DOC_NAV: Pick<RequestOptions, "secFetchMode"> = { secFetchMode: "navigate" };

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Admin gating ────────────────────────────────────────────────────────────

describe("admin proxy route protection", () => {
	it("redirects unauthenticated visitors to login with the redirect param", async () => {
		const response = await runProxy({ pathname: "/users" });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3001/auth/login?redirect=%2Fusers");
	});

	it("redirects authenticated non-admins back to login", async () => {
		const response = await runProxy({ pathname: "/", accessToken: nonAdminToken() });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3001/auth/login");
	});

	it("serves the panel to admins", async () => {
		const response = await runProxy({ pathname: "/users", accessToken: adminToken(3600) });

		expect(response.status).toBe(200);
		expect(nextResponse.next).toHaveBeenCalled();
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("bounces admins away from auth routes back into the panel", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600) });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3001/");
	});

	it("blocks open-redirect attempts on auth routes", async () => {
		await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), query: { redirect: "//evil.com" } });
		expect(redirectTarget()).toBe("http://localhost:3001/");

		vi.clearAllMocks();
		await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), query: { redirect: "/auth/login" } });
		expect(redirectTarget()).toBe("http://localhost:3001/");
	});

	it("serves login when the access token is expired and no refresh token exists", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: expiredNonAdminToken() });

		expect(response.status).toBe(200);
		expect(nextResponse.next).toHaveBeenCalled();
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("redirects protected routes to login when the access token is expired with no refresh", async () => {
		const response = await runProxy({ pathname: "/", accessToken: expiredNonAdminToken() });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3001/auth/login?redirect=%2F");
	});
});

// ── Server-side refresh ─────────────────────────────────────────────────────

describe("admin proxy server-side refresh", () => {
	it("skips the refresh on a second navigation after a transient failure (cooldown)", async () => {
		// MUST run FIRST in this describe block: the module-scope cooldown
		// survives across tests, and a real-time failure elsewhere would arm it
		// with a timestamp that clashes with this test's controlled fake clock.
		// This test ends with a successful refresh, which clears the cooldown.
		vi.useFakeTimers();
		try {
			vi.setSystemTime(1_700_000_000_000);

			// FIRST navigation: API down → transient failure, which arms the 60s cooldown.
			const failingFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
			vi.stubGlobal("fetch", failingFetch);
			const firstResponse = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt-admin-cooldown", ...DOC_NAV });

			expect(firstResponse.status).toBe(200);
			expect(failingFetch).toHaveBeenCalledTimes(1);

			// SECOND navigation (still inside the 60s window): refresh short-circuited
			// by the cooldown — no network call, stale page served.
			const secondResponse = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt-admin-cooldown", ...DOC_NAV });

			expect(secondResponse.status).toBe(200);
			expect(secondResponse.cookies.calls).toHaveLength(0);
			expect(failingFetch).toHaveBeenCalledTimes(1);

			// Move past the cooldown and restore a healthy API: the refresh works
			// again (success also clears the cooldown, so later tests are unaffected).
			// The rotated token must be a real admin JWT — the proxy re-decodes it
			// to re-evaluate hasAdminAccess, and a non-JWT would bounce to login.
			await vi.advanceTimersByTimeAsync(60_001);
			const rotated = adminToken(3600);
			stubRefreshResponse(200, [`adminAccessToken=${rotated}; Path=/; HttpOnly`]);
			const thirdResponse = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt-admin-cooldown", ...DOC_NAV });

			expect(thirdResponse.status).toBe(200);
			expect(thirdResponse.cookies.calls.find((call) => call.name === "adminAccessToken")?.value).toBe(rotated);
		} finally {
			vi.useRealTimers();
		}
	});

	it("re-evaluates hasAdminAccess from the rotated token after a refresh", async () => {
		// The presented (expired) token is NOT an admin. The refresh rotates in
		// an admin token — the proxy must gate on the ROTATED session, not the
		// stale one, and serve the panel instead of bouncing to login.
		const rotated = adminToken(3600);
		stubRefreshResponse(200, [`adminAccessToken=${rotated}; Path=/; HttpOnly`]);

		const response = await runProxy({ pathname: "/", accessToken: expiredNonAdminToken(), refreshToken: "rt-old", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(nextResponse.redirect).not.toHaveBeenCalled();

		const accessCall = response.cookies.calls.find((call) => call.name === "adminAccessToken");
		expect(accessCall?.value).toBe(rotated);
	});

	it("clears stale cookies and redirects to login when the refresh token is dead", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({ pathname: "/", accessToken: expiredNonAdminToken(), refreshToken: "rt-dead", ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3001/auth/login?redirect=%2F");

		const cleared = response.cookies.calls.filter((call) => call.value === "");
		expect(cleared.map((call) => call.name).sort()).toEqual(["adminAccessToken", "adminRefreshToken"]);
		expect(cleared.every((call) => call.options?.maxAge === 0)).toBe(true);
	});

	it("serves the panel without clearing cookies on a transient refresh failure", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

		const response = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(response.cookies.calls).toHaveLength(0);
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});
});
