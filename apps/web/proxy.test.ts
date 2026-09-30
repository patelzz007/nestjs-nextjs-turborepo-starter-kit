import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { isAccessTokenExpired, resolveProxySessionRefresh, shouldAttemptProxyRefresh } from "@workspace/client/lib/auth/edge/proxy-refresh";

import { proxy, resetWebProxyRefreshCooldownForTests } from "./proxy";

// ── Mocks ──────────────────────────────────────────────────────────────────
// `next/server` is intentionally NOT mocked: real NextRequest/NextResponse
// run fine in the node vitest environment, so tests assert on actual response
// objects (status, Location header, cookies) instead of casting fake doubles.

vi.mock("@workspace/client/lib/api/config", () => ({ API_BASE_URL: "http://api.test", API_URL_PREFIX: "/api/v1" }));

// ── Request / response plumbing ─────────────────────────────────────────────

interface RequestOptions {
	readonly pathname?: string;
	readonly accessToken?: string | null;
	readonly refreshToken?: string | null;
	readonly secFetchMode?: string | null;
	readonly accept?: string | null;
	readonly query?: Record<string, string>;
}

function makeRequest(options: RequestOptions): NextRequest {
	const headers = new Headers();
	if (options.secFetchMode !== null && options.secFetchMode !== undefined) headers.set("sec-fetch-mode", options.secFetchMode);
	if (options.accept !== null && options.accept !== undefined) headers.set("accept", options.accept);

	const cookieParts: string[] = [];
	if (options.accessToken !== null && options.accessToken !== undefined) cookieParts.push(`accessToken=${options.accessToken}`);
	if (options.refreshToken !== null && options.refreshToken !== undefined) cookieParts.push(`refreshToken=${options.refreshToken}`);
	if (cookieParts.length > 0) headers.set("cookie", cookieParts.join("; "));

	const url = new URL(`http://localhost:3000${options.pathname ?? "/"}`);
	for (const [name, value] of Object.entries(options.query ?? {})) url.searchParams.set(name, value);

	return new NextRequest(url, { headers });
}

function runProxy(options: RequestOptions): Promise<NextResponse> {
	return proxy(makeRequest(options));
}

/** The redirect target of a redirect response, or undefined when it did not redirect. */
function redirectLocation(response: NextResponse): string | undefined {
	return response.headers.get("location") ?? undefined;
}

/** The value of a cookie set on the response, or undefined when absent. */
function cookieValue(response: NextResponse, name: string): string | undefined {
	return response.cookies.get(name)?.value;
}

/** Auth cookies the proxy cleared (present with an empty value), sorted. */
function clearedCookieNames(response: NextResponse): readonly string[] {
	return ["accessToken", "refreshToken"].filter((name) => cookieValue(response, name) === "").sort();
}

interface JwtHeader {
	readonly alg: string;
	readonly typ: string;
}

interface JwtClaims {
	readonly sub: string;
	readonly exp: number;
}

function base64UrlJson(value: JwtHeader | JwtClaims): string {
	return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(payload: JwtClaims): string {
	return `${base64UrlJson({ alg: "none", typ: "JWT" })}.${base64UrlJson(payload)}.signature`;
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
		expect(redirectLocation(response)).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
	});

	it("allows authenticated users at the root without redirect", async () => {
		const response = await runProxy({ pathname: "/", accessToken: validToken(), refreshToken: "rt" });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("clears orphaned access cookies on protected routes", async () => {
		const response = await runProxy({ pathname: "/hello", accessToken: validToken() });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
		expect(clearedCookieNames(response)).toEqual(["accessToken", "refreshToken"]);
	});

	it("bounces authenticated users away from auth routes", async () => {
		stubRefreshResponse(200, ["accessToken=live-at; Path=/; HttpOnly", "refreshToken=live-rt; Path=/; HttpOnly"]);
		const response = await runProxy({ pathname: "/auth/login", accessToken: validToken(), refreshToken: "rt", ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3000/rewardhub");
	});

	it("allows authenticated users to open verify-email links", async () => {
		const response = await runProxy({
			pathname: "/auth/verify-email",
			accessToken: validToken(),
			refreshToken: "rt",
			query: { token: "test-token" },
		});

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("does not silently refresh token-auth verify-email pages", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const response = await runProxy({
			pathname: "/auth/verify-email",
			accessToken: validToken(),
			refreshToken: "rt",
			query: { token: "test-token" },
			...DOC_NAV,
		});

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("allows authenticated users to open reset-password links", async () => {
		const response = await runProxy({
			pathname: "/auth/reset-password",
			accessToken: validToken(),
			refreshToken: "rt",
			query: { token: "test-token" },
		});

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("honours the redirect param on auth routes", async () => {
		stubRefreshResponse(200, ["accessToken=live-at; Path=/; HttpOnly", "refreshToken=live-rt; Path=/; HttpOnly"]);
		const response = await runProxy({ pathname: "/auth/login", accessToken: validToken(), refreshToken: "rt", ...DOC_NAV, query: { redirect: "/hello" } });

		expect(redirectLocation(response)).toBe("http://localhost:3000/hello");
	});

	it("ignores a redirect param that is not a protected route (no open redirects)", async () => {
		stubRefreshResponse(200, ["accessToken=live-at; Path=/; HttpOnly", "refreshToken=live-rt; Path=/; HttpOnly"]);
		const response = await runProxy({ pathname: "/auth/login", accessToken: validToken(), refreshToken: "rt", ...DOC_NAV, query: { redirect: "//evil.com" } });

		expect(redirectLocation(response)).toBe("http://localhost:3000/rewardhub");
	});

	it("serves public routes to everyone", async () => {
		const response = await runProxy({ pathname: "/about" });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("serves login when the access token is expired and no refresh token exists", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: expiredToken() });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("redirects protected routes to login when the access token is expired with no refresh", async () => {
		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken() });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
	});

	it("serves the home page as guest when the session is dead (no login redirect)", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({ pathname: "/", accessToken: expiredToken(), refreshToken: "rt-dead", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("clears stale cookies on guest routes when access token exists without refresh", async () => {
		const response = await runProxy({ pathname: "/", accessToken: expiredToken() });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
		expect(clearedCookieNames(response)).toEqual(["accessToken", "refreshToken"]);
	});
});

// ── Server-side refresh ─────────────────────────────────────────────────────

describe("web proxy server-side refresh", () => {
	it("attempts refresh for expired tokens on protected routes", async () => {
		expect(
			shouldAttemptProxyRefresh({
				accessToken: expiredToken(),
				refreshToken: "rt",
				isDocumentNavigation: true,
				isAuthRoute: false,
				isPublicRoute: false,
				tokenAuthRoute: false,
			}),
		).toBe(true);

		// A successful refresh must rotate BOTH auth cookies (the client library
		// rejects a response that is missing either one) — see `hasRotatedAuthCookies`.
		const attemptRefresh = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			setCookies: ["accessToken=new-at; Path=/; HttpOnly", "refreshToken=new-rt; Path=/; HttpOnly"],
		});

		const result = await resolveProxySessionRefresh({
			accessToken: expiredToken(),
			refreshToken: "rt",
			isDocumentNavigation: true,
			isAuthRoute: false,
			isPublicRoute: false,
			tokenAuthRoute: false,
			accessTokenCookieName: "accessToken",
			refreshTokenCookieName: "refreshToken",
			app: "web",
			pathname: "/hello",
			attemptRefresh,
		});

		expect(attemptRefresh).toHaveBeenCalled();
		expect(result.effectiveAccessToken).toBe("new-at");
	});

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
			expect(cookieValue(secondResponse, "accessToken")).toBeUndefined();
			expect(cookieValue(secondResponse, "refreshToken")).toBeUndefined();
			expect(failingFetch).toHaveBeenCalledTimes(1);

			// Move past the cooldown and restore a healthy API: the refresh works
			// again (success also clears the cooldown, so later tests are unaffected).
			await vi.advanceTimersByTimeAsync(60_001);
			stubRefreshResponse(200, ["accessToken=new-at; Path=/; HttpOnly", "refreshToken=new-rt; Path=/; HttpOnly"]);
			const thirdResponse = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-cooldown", ...DOC_NAV });

			expect(thirdResponse.status).toBe(200);
			expect(cookieValue(thirdResponse, "accessToken")).toBe("new-at");
		} finally {
			vi.useRealTimers();
		}
	});

	it("refreshes an expired session on document navigation and forwards rotated cookies", async () => {
		const setCookies = ["accessToken=new-at; Path=/; HttpOnly; Secure; SameSite=Lax", "refreshToken=new-rt; Path=/; HttpOnly"];
		stubRefreshResponse(200, setCookies);

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-old", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();

		const accessCookie = response.cookies.get("accessToken");
		expect(accessCookie?.value).toBe("new-at");
		expect(accessCookie?.httpOnly).toBe(true);
		expect(accessCookie?.secure).toBe(true);
		expect(accessCookie?.sameSite).toBe("lax");
		expect(accessCookie?.path).toBe("/");

		const refreshCookie = response.cookies.get("refreshToken");
		expect(refreshCookie?.value).toBe("new-rt");
	});

	it("clears stale cookies and redirects to login when the refresh token is dead", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt-dead", ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");

		const cleared = clearedCookieNames(response);
		expect(cleared).toEqual(["accessToken", "refreshToken"]);
		expect(cleared.every((name) => response.cookies.get(name)?.maxAge === 0)).toBe(true);
	});

	it("serves the page without clearing cookies on a transient refresh failure", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), refreshToken: "rt", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(cookieValue(response, "accessToken")).toBeUndefined();
		expect(cookieValue(response, "refreshToken")).toBeUndefined();
		expect(redirectLocation(response)).toBeUndefined();
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

	it("clears cookies on login when the refresh token is dead but access is still time-valid", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({
			pathname: "/auth/login",
			accessToken: validToken(),
			refreshToken: "rt-dead",
			secFetchMode: "cors",
			accept: "*/*",
		});

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
		expect(clearedCookieNames(response)).toEqual(["accessToken", "refreshToken"]);
	});

	it("serves login without bounce when only an orphaned access cookie remains", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: validToken() });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
		expect(clearedCookieNames(response)).toEqual(["accessToken", "refreshToken"]);
	});

	it("redirects protected routes to login when the refresh cookie is missing", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const response = await runProxy({ pathname: "/hello", accessToken: expiredToken(), ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3000/auth/login?redirect=%2Fhello");
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
