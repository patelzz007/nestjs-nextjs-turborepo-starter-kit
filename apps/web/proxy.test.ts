import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { proxy, resetWebProxyRefreshCooldownForTests } from "./proxy";
import { isAccessTokenExpired } from "@workspace/client/lib/auth/proxy-refresh";

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
		const value = name === "accessToken" ? options.accessToken : name === "refreshToken" ? options.refreshToken : undefined;
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
		url: `http://localhost:3000${options.pathname ?? "/"}`,
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

function expiredToken(): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) - 60 });
}

function validToken(): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) + 3600 });
}

function stubRefreshResponse(status: number, setCookies: readonly string[]): void {
	const headers = new Headers();
	for (const header of setCookies) headers.append("set-cookie", header);
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status, headers })));
}

const DOC_NAV: Pick<RequestOptions, "secFetchMode"> = { secFetchMode: "navigate" };

beforeEach(() => {
	vi.clearAllMocks();
	resetWebProxyRefreshCooldownForTests();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Route protection ────────────────────────────────────────────────────────

describe("web proxy route protection", () => {
	it("detects expired access tokens in the test JWT helper", () => {
		expect(isAccessTokenExpired(expiredToken())).toBe(true);
	});

	it("redirects unauthenticated visitors on protected routes to login", async () => {
		const response = await runProxy({ pathname: "/hello" });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
	});

	it("allows authenticated users at the root without redirect", async () => {
		const response = await runProxy({ pathname: "/", accessToken: validToken() });

		expect(response.status).toBe(200);
		expect(nextResponse.next).toHaveBeenCalled();
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("bounces authenticated users away from auth routes", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: validToken() });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3000/rewardhub");
	});

	it("honours the redirect param on auth routes", async () => {
		await runProxy({ pathname: "/auth/login", accessToken: validToken(), query: { redirect: "/hello" } });

		expect(redirectTarget()).toBe("http://localhost:3000/hello");
	});

	it("ignores a redirect param that is not a protected route (no open redirects)", async () => {
		await runProxy({ pathname: "/auth/login", accessToken: validToken(), query: { redirect: "//evil.com" } });

		expect(redirectTarget()).toBe("http://localhost:3000/rewardhub");
	});

	it("serves public routes to everyone", async () => {
		const response = await runProxy({ pathname: "/about" });

		expect(response.status).toBe(200);
		expect(nextResponse.next).toHaveBeenCalled();
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("serves login when the access token is expired and no refresh token exists", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: expiredToken() });

		expect(response.status).toBe(200);
		expect(nextResponse.next).toHaveBeenCalled();
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("redirects protected routes to login when the access token is expired with no refresh", async () => {
		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken() });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
	});

	it("serves the home page as guest when the session is dead (no login redirect)", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({ pathname: "/", accessToken: expiredToken(), refreshToken: "rt-dead", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(nextResponse.next).toHaveBeenCalled();
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("clears stale cookies on guest routes when access token exists without refresh", async () => {
		const response = await runProxy({ pathname: "/", accessToken: expiredToken() });

		expect(response.status).toBe(200);
		expect(nextResponse.redirect).not.toHaveBeenCalled();

		const cleared = response.cookies.calls.filter((call) => call.value === "");
		expect(cleared.map((call) => call.name).sort()).toEqual(["accessToken", "refreshToken"]);
	});
});

// ── Server-side refresh ─────────────────────────────────────────────────────

describe("web proxy server-side refresh", () => {
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
			const firstResponse = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-cooldown", ...DOC_NAV });

			expect(firstResponse.status).toBe(200);
			expect(failingFetch).toHaveBeenCalledTimes(1);

			// SECOND navigation (still inside the 60s window): the refresh is
			// short-circuited by the cooldown — no network call, stale page served.
			const secondResponse = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-cooldown", ...DOC_NAV });

			expect(secondResponse.status).toBe(200);
			expect(secondResponse.cookies.calls).toHaveLength(0);
			expect(failingFetch).toHaveBeenCalledTimes(1);

			// Move past the cooldown and restore a healthy API: the refresh works
			// again (success also clears the cooldown, so later tests are unaffected).
			await vi.advanceTimersByTimeAsync(60_001);
			stubRefreshResponse(200, ["accessToken=new-at; Path=/; HttpOnly"]);
			const thirdResponse = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-cooldown", ...DOC_NAV });

			expect(thirdResponse.status).toBe(200);
			expect(thirdResponse.cookies.calls.find((call) => call.name === "accessToken")?.value).toBe("new-at");
		} finally {
			vi.useRealTimers();
		}
	});

	it("refreshes an expired session on document navigation and forwards rotated cookies", async () => {
		const setCookies = ["accessToken=new-at; Path=/; HttpOnly; Secure; SameSite=Lax", "refreshToken=new-rt; Path=/; HttpOnly"];
		stubRefreshResponse(200, setCookies);

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-old", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(nextResponse.redirect).not.toHaveBeenCalled();

		const accessCall = response.cookies.calls.find((call) => call.name === "accessToken");
		expect(accessCall?.value).toBe("new-at");
		expect(accessCall?.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });

		const refreshCall = response.cookies.calls.find((call) => call.name === "refreshToken");
		expect(refreshCall?.value).toBe("new-rt");
	});

	it("clears stale cookies and redirects to login when the refresh token is dead", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-dead", ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");

		const cleared = response.cookies.calls.filter((call) => call.value === "");
		expect(cleared.map((call) => call.name).sort()).toEqual(["accessToken", "refreshToken"]);
		expect(cleared.every((call) => call.options?.maxAge === 0)).toBe(true);
	});

	it("serves the page without clearing cookies on a transient refresh failure", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(response.cookies.calls).toHaveLength(0);
		expect(nextResponse.redirect).not.toHaveBeenCalled();
	});

	it("does not refresh for RSC / prefetch data requests", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt", secFetchMode: "cors", accept: "*/*" });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("does not refresh when the access token is still valid", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await runProxy({ pathname: "/hello", accessToken: validToken(), refreshToken: "rt", ...DOC_NAV });

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("redirects protected routes to login when the refresh cookie is missing", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectTarget()).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
