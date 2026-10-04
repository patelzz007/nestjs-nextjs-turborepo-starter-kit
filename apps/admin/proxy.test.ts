import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

import { PROXY_REFRESH_COOLDOWN_MS } from "@workspace/client/lib/auth/edge/proxy-refresh";

import { createAdminProxy, createAdminRefreshAttempt, type AdminProxy } from "./proxy";

// ── Mocks ──────────────────────────────────────────────────────────────────
// `next/server` is intentionally NOT mocked: real NextRequest/NextResponse
// run fine in the node vitest environment, so tests assert on actual response
// objects (status, Location header, cookies) instead of casting fake doubles.

vi.mock("@workspace/client/lib/api/config", () => ({ API_BASE_URL: "http://api.test", API_URL_PREFIX: "/api/v1", RUNTIME_NODE_ENV: "test" }));

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
	if (options.accessToken !== null && options.accessToken !== undefined) cookieParts.push(`adminAccessToken=${options.accessToken}`);
	if (options.refreshToken !== null && options.refreshToken !== undefined) cookieParts.push(`adminRefreshToken=${options.refreshToken}`);
	if (cookieParts.length > 0) headers.set("cookie", cookieParts.join("; "));

	const url = new URL(`http://localhost:3001${options.pathname ?? "/"}`);
	for (const [name, value] of Object.entries(options.query ?? {})) url.searchParams.set(name, value);

	return new NextRequest(url, { headers });
}

/** A fresh proxy per test, so no refresh cooldown leaks between tests. */
let proxy: AdminProxy = createAdminProxy(createAdminRefreshAttempt());

function runProxy(options: RequestOptions): Promise<NextResponse> {
	return proxy(makeRequest(options));
}

/** The redirect target of a redirect response, or undefined when it did not redirect. */
function redirectLocation(response: NextResponse): string | undefined {
	return response.headers.get("location") ?? undefined;
}

/** Names of the cookies the proxy cleared (set with an empty value), sorted. */
function clearedCookieNames(response: NextResponse): readonly string[] {
	return response.cookies
		.getAll()
		.filter((cookie) => cookie.value === "")
		.map((cookie) => cookie.name)
		.sort();
}

interface JwtHeader {
	readonly alg: string;
	readonly typ: string;
}

interface AdminJwtClaims {
	readonly sub: string;
	readonly exp: number;
	readonly hasAdminAccess: boolean;
	readonly sessionScope?: "restricted";
	readonly isEmailVerified?: boolean;
}

function base64UrlJson(value: JwtHeader | AdminJwtClaims): string {
	return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(payload: AdminJwtClaims): string {
	return `${base64UrlJson({ alg: "none", typ: "JWT" })}.${base64UrlJson(payload)}.signature`;
}

/** An expired admin token WITHOUT admin access (hasAdminAccess: false). */
function expiredNonAdminToken(): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) - 60, hasAdminAccess: false });
}

function adminToken(expInSeconds: number): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) + expInSeconds, hasAdminAccess: true });
}

/** A live admin token for a restricted (enrollment) session — MFA not yet enrolled. */
function restrictedAdminToken(): string {
	return makeJwt({ sub: "u_1", exp: Math.floor(Date.now() / 1000) + 3600, hasAdminAccess: true, sessionScope: "restricted", isEmailVerified: true });
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
	proxy = createAdminProxy(createAdminRefreshAttempt());
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Admin gating ────────────────────────────────────────────────────────────

describe("admin proxy route protection", () => {
	it("redirects unauthenticated visitors to login with the redirect param", async () => {
		const response = await runProxy({ pathname: "/users" });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/auth/login?redirect=%2Fusers");
	});

	it("redirects authenticated non-admins back to login", async () => {
		const response = await runProxy({ pathname: "/", accessToken: nonAdminToken(), refreshToken: "rt" });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/auth/login");
	});

	it("serves the panel to admins", async () => {
		const response = await runProxy({ pathname: "/users", accessToken: adminToken(3600), refreshToken: "rt" });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("sends restricted (enrollment) sessions to the personal account pages", async () => {
		const response = await runProxy({ pathname: "/merchants", accessToken: restrictedAdminToken(), refreshToken: "rt" });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/account");
	});

	it("lets restricted sessions reach /account/** to finish enrollment", async () => {
		for (const pathname of ["/account", "/account/security"]) {
			const response = await runProxy({ pathname, accessToken: restrictedAdminToken(), refreshToken: "rt" });

			expect(response.status, pathname).toBe(200);
			expect(redirectLocation(response), pathname).toBeUndefined();
		}
	});

	it("does not treat a look-alike of an auth route as an auth page (segment-aware)", async () => {
		const response = await runProxy({ pathname: "/auth/loginx" });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/auth/login?redirect=%2Fauth%2Floginx");
	});

	it("serves the emailed verify-email token link even while an admin session is active", async () => {
		const response = await runProxy({ pathname: "/auth/verify-email", accessToken: adminToken(3600), refreshToken: "rt", query: { token: "tok" } });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("bounces admins away from auth routes back into the panel", async () => {
		const live = adminToken(3600);
		stubRefreshResponse(200, [`adminAccessToken=${live}; Path=/; HttpOnly`, "adminRefreshToken=live-rt; Path=/; HttpOnly"]);
		const response = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), refreshToken: "rt", ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/");
	});

	it("blocks open-redirect attempts on auth routes", async () => {
		const live = adminToken(3600);
		stubRefreshResponse(200, [`adminAccessToken=${live}; Path=/; HttpOnly`, "adminRefreshToken=live-rt; Path=/; HttpOnly"]);
		const evilResponse = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), refreshToken: "rt", ...DOC_NAV, query: { redirect: "//evil.com" } });
		expect(redirectLocation(evilResponse)).toBe("http://localhost:3001/");

		const loopResponse = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), refreshToken: "rt", ...DOC_NAV, query: { redirect: "/auth/login" } });
		expect(redirectLocation(loopResponse)).toBe("http://localhost:3001/");
	});

	// `searchParams.get` percent-decodes once, so each value below reaches the
	// proxy as a backslash / tab form that a browser resolves to evil.com.
	it.each(["/%5Cevil.com", "/%09/evil.com", "/\\/evil.com", "/%2F/evil.com", "/AUTH/login"])(
		"never redirects off-origin or into the auth pages for %s",
		async (redirect: string) => {
			const live = adminToken(3600);
			stubRefreshResponse(200, [`adminAccessToken=${live}; Path=/; HttpOnly`, "adminRefreshToken=live-rt; Path=/; HttpOnly"]);
			const response = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), refreshToken: "rt", ...DOC_NAV, query: { redirect } });

			expect(redirectLocation(response)).toBe("http://localhost:3001/");
		},
	);

	it("follows a safe redirect with its query string, normalized", async () => {
		const live = adminToken(3600);
		stubRefreshResponse(200, [`adminAccessToken=${live}; Path=/; HttpOnly`, "adminRefreshToken=live-rt; Path=/; HttpOnly"]);
		const response = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600), refreshToken: "rt", ...DOC_NAV, query: { redirect: "/users/./?page=2" } });

		expect(redirectLocation(response)).toBe("http://localhost:3001/users/?page=2");
	});

	it("serves login when the access token is expired and no refresh token exists", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: expiredNonAdminToken() });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("redirects protected routes to login when the access token is expired with no refresh", async () => {
		const response = await runProxy({ pathname: "/", accessToken: expiredNonAdminToken() });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/auth/login?redirect=%2F");
	});

	it("clears orphaned access cookies on panel routes", async () => {
		const response = await runProxy({ pathname: "/users", accessToken: adminToken(3600) });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/auth/login?redirect=%2Fusers");
		expect(clearedCookieNames(response)).toEqual(["adminAccessToken", "adminRefreshToken"]);
	});
});

// ── Server-side refresh ─────────────────────────────────────────────────────

describe("admin proxy server-side refresh", () => {
	it("skips the refresh on a second navigation after a transient failure (cooldown)", async () => {
		// The breaker's clock is injected, so time moves only when the test says so.
		let nowMs = 1_700_000_000_000;
		proxy = createAdminProxy(createAdminRefreshAttempt({ now: (): number => nowMs }));

		// FIRST navigation: API down → transient failure, which arms the cooldown.
		const failingFetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
		vi.stubGlobal("fetch", failingFetch);
		const firstResponse = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt-admin-cooldown", ...DOC_NAV });

		expect(firstResponse.status).toBe(200);
		expect(failingFetch).toHaveBeenCalledTimes(1);

		// SECOND navigation (still inside the window): refresh short-circuited by
		// the cooldown — no network call, stale page served.
		const secondResponse = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt-admin-cooldown", ...DOC_NAV });

		expect(secondResponse.status).toBe(200);
		expect(secondResponse.cookies.getAll()).toHaveLength(0);
		expect(failingFetch).toHaveBeenCalledTimes(1);

		// Past the cooldown, with a healthy API, the refresh runs again. The
		// rotated token must be a real admin JWT — the proxy re-decodes it to
		// re-evaluate hasAdminAccess, and a non-JWT would bounce to login.
		nowMs += PROXY_REFRESH_COOLDOWN_MS + 1;
		const rotated = adminToken(3600);
		stubRefreshResponse(200, [`adminAccessToken=${rotated}; Path=/; HttpOnly`, `adminRefreshToken=rt-admin-cooldown-rotated; Path=/; HttpOnly`]);
		const thirdResponse = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt-admin-cooldown", ...DOC_NAV });

		expect(thirdResponse.status).toBe(200);
		expect(thirdResponse.cookies.get("adminAccessToken")?.value).toBe(rotated);
	});

	it("re-evaluates hasAdminAccess from the rotated token after a refresh", async () => {
		// The presented (expired) token is NOT an admin. The refresh rotates in
		// an admin token — the proxy must gate on the ROTATED session, not the
		// stale one, and serve the panel instead of bouncing to login.
		const rotated = adminToken(3600);
		stubRefreshResponse(200, [`adminAccessToken=${rotated}; Path=/; HttpOnly`, `adminRefreshToken=rt-rotated; Path=/; HttpOnly`]);

		const response = await runProxy({ pathname: "/", accessToken: expiredNonAdminToken(), refreshToken: "rt-old", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();

		expect(response.cookies.get("adminAccessToken")?.value).toBe(rotated);
	});

	it("clears stale cookies and redirects to login when the refresh token is dead", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({ pathname: "/", accessToken: expiredNonAdminToken(), refreshToken: "rt-dead", ...DOC_NAV });

		expect(response.status).toBe(307);
		expect(redirectLocation(response)).toBe("http://localhost:3001/auth/login?redirect=%2F");

		const cleared = clearedCookieNames(response);
		expect(cleared).toEqual(["adminAccessToken", "adminRefreshToken"]);
		expect(cleared.every((name) => response.cookies.get(name)?.maxAge === 0)).toBe(true);
	});

	it("serves the panel without clearing cookies on a transient refresh failure", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

		const response = await runProxy({ pathname: "/", accessToken: adminToken(-60), refreshToken: "rt", ...DOC_NAV });

		expect(response.status).toBe(200);
		expect(response.cookies.getAll()).toHaveLength(0);
		expect(redirectLocation(response)).toBeUndefined();
	});

	it("clears cookies on login when the refresh token is dead but access is still time-valid", async () => {
		stubRefreshResponse(401, []);

		const response = await runProxy({
			pathname: "/auth/login",
			accessToken: adminToken(3600),
			refreshToken: "rt-dead",
			secFetchMode: "cors",
			accept: "*/*",
		});

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
		expect(clearedCookieNames(response)).toEqual(["adminAccessToken", "adminRefreshToken"]);
	});

	it("serves login without bounce when only an orphaned access cookie remains", async () => {
		const response = await runProxy({ pathname: "/auth/login", accessToken: adminToken(3600) });

		expect(response.status).toBe(200);
		expect(redirectLocation(response)).toBeUndefined();
		expect(clearedCookieNames(response)).toEqual(["adminAccessToken", "adminRefreshToken"]);
	});
});
