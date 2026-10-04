import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";

import { proxy, resetMerchantProxyRefreshCooldownForTests } from "./proxy";

// `next/server` is intentionally NOT mocked: real NextRequest/NextResponse run in
// the node environment, so tests assert on actual responses (status, Location, cookies).

vi.mock("@workspace/client/lib/api/config", () => ({ API_BASE_URL: "http://api.test", API_URL_PREFIX: "/api/v1", RUNTIME_NODE_ENV: "test" }));

const ORIGIN = "http://localhost:3003";
const ACCESS_COOKIE = "merchantAccessToken";
const REFRESH_COOKIE = "merchantRefreshToken";
const SECONDS_PER_HOUR = 3600;
const MS_PER_SECOND = 1000;

interface RequestOptions {
	readonly pathname?: string;
	readonly accessToken?: string;
	readonly refreshToken?: string;
	readonly organizationSlug?: string;
	readonly isDocumentNavigation?: boolean;
	readonly query?: Readonly<Record<string, string>>;
}

function makeRequest(options: RequestOptions): NextRequest {
	const headers = new Headers();
	if (options.isDocumentNavigation === true) headers.set("sec-fetch-mode", "navigate");
	const cookies: string[] = [];
	if (options.accessToken !== undefined) cookies.push(`${ACCESS_COOKIE}=${options.accessToken}`);
	if (options.refreshToken !== undefined) cookies.push(`${REFRESH_COOKIE}=${options.refreshToken}`);
	if (options.organizationSlug !== undefined) cookies.push(`${ORGANIZATION_SLUG_COOKIE_NAME}=${encodeURIComponent(options.organizationSlug)}`);
	if (cookies.length > 0) headers.set("cookie", cookies.join("; "));
	const url = new URL(`${ORIGIN}${options.pathname ?? "/"}`);
	for (const [name, value] of Object.entries(options.query ?? {})) url.searchParams.set(name, value);
	return new NextRequest(url, { headers });
}

function runProxy(options: RequestOptions): Promise<NextResponse> {
	return proxy(makeRequest(options));
}

function location(response: NextResponse): string | undefined {
	return response.headers.get("location") ?? undefined;
}

interface JwtClaims {
	readonly sub: string;
	readonly exp: number;
	readonly sessionScope?: "restricted" | "full";
	readonly isEmailVerified?: boolean;
}

function base64UrlJson(value: JwtClaims | { readonly alg: string; readonly typ: string }): string {
	return btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function token(claims: Partial<JwtClaims> = {}): string {
	return `${base64UrlJson({ alg: "none", typ: "JWT" })}.${base64UrlJson({ sub: "u_1", exp: Math.floor(Date.now() / MS_PER_SECOND) + SECONDS_PER_HOUR, ...claims })}.signature`;
}

function expiredToken(): string {
	return token({ exp: Math.floor(Date.now() / MS_PER_SECOND) - SECONDS_PER_HOUR });
}

function stubRefresh(status: number, setCookies: readonly string[]): void {
	const headers = new Headers();
	for (const header of setCookies) headers.append("set-cookie", header);
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status, headers })));
}

beforeEach((): void => {
	vi.clearAllMocks();
	resetMerchantProxyRefreshCooldownForTests();
});

afterEach((): void => {
	vi.unstubAllGlobals();
});

describe("merchant proxy route protection", () => {
	it.each(["/", "/account", "/orgs/acme-coffee/dashboard"])("sends a guest on %s to login, returning there afterwards", async (pathname: string) => {
		const response = await runProxy({ pathname });

		expect(response.status).toBe(307);
		expect(location(response)).toBe(`${ORIGIN}/auth/login?redirect=${encodeURIComponent(pathname)}`);
	});

	it("serves the login page to a guest", async () => {
		const response = await runProxy({ pathname: "/auth/login" });

		expect(response.status).toBe(200);
		expect(location(response)).toBeUndefined();
	});

	it("lets a signed-in merchant through to org pages", async () => {
		const response = await runProxy({ pathname: "/orgs/acme-coffee/dashboard", accessToken: token(), refreshToken: "rt" });

		expect(response.status).toBe(200);
		expect(location(response)).toBeUndefined();
	});

	it("clears an orphaned access cookie and sends the visitor to login", async () => {
		const response = await runProxy({ pathname: "/orgs/acme-coffee/dashboard", accessToken: token() });

		expect(response.status).toBe(307);
		expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe("");
		expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe("");
	});

	it("bounces a signed-in merchant off login to an allowed ?redirect=, never off-site", async () => {
		stubRefresh(200, [`${ACCESS_COOKIE}=live; Path=/; HttpOnly`, `${REFRESH_COOKIE}=live-rt; Path=/; HttpOnly`]);
		const allowed = await runProxy({ pathname: "/auth/login", accessToken: token(), refreshToken: "rt", isDocumentNavigation: true, query: { redirect: "/account" } });
		expect(location(allowed)).toBe(`${ORIGIN}/account`);

		const offSite = await runProxy({ pathname: "/auth/login", accessToken: token(), refreshToken: "rt", isDocumentNavigation: true, query: { redirect: "//evil.example" } });
		expect(location(offSite)).toBe(`${ORIGIN}/`);
	});

	it("lets a signed-in merchant open a one-shot token link (team invite)", async () => {
		const response = await runProxy({ pathname: "/team-invite", accessToken: token(), refreshToken: "rt", query: { token: "invite-token" } });

		expect(response.status).toBe(200);
		expect(location(response)).toBeUndefined();
	});
});

describe("merchant proxy enrollment redirect", () => {
	const restricted = (): string => token({ sessionScope: "restricted", isEmailVerified: false });

	it("sends a restricted session to the preferred organization's account page", async () => {
		const response = await runProxy({ pathname: "/orgs/acme-coffee/rewards", accessToken: restricted(), refreshToken: "rt", organizationSlug: "acme-coffee" });

		expect(response.status).toBe(307);
		expect(location(response)).toBe(`${ORIGIN}/orgs/acme-coffee/account`);
	});

	it("never builds a redirect path from a tampered organization cookie", async () => {
		const response = await runProxy({ pathname: "/orgs/acme-coffee/rewards", accessToken: restricted(), refreshToken: "rt", organizationSlug: "../../evil" });

		expect(response.status).toBe(307);
		expect(location(response)).toBe(`${ORIGIN}/account`);
	});
});

describe("merchant proxy session refresh", () => {
	it("refreshes an expired session on a document navigation and forwards the rotated cookies", async () => {
		stubRefresh(200, [`${ACCESS_COOKIE}=new-at; Path=/; HttpOnly`, `${REFRESH_COOKIE}=new-rt; Path=/; HttpOnly`]);

		const response = await runProxy({ pathname: "/orgs/acme-coffee/dashboard", accessToken: expiredToken(), refreshToken: "rt-old", isDocumentNavigation: true });

		expect(response.status).toBe(200);
		expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe("new-at");
		expect(response.cookies.get(REFRESH_COOKIE)?.value).toBe("new-rt");
	});

	it("clears the cookies and sends the merchant to login when the refresh token is dead", async () => {
		stubRefresh(401, []);

		const response = await runProxy({ pathname: "/orgs/acme-coffee/dashboard", accessToken: expiredToken(), refreshToken: "rt-dead", isDocumentNavigation: true });

		expect(response.status).toBe(307);
		expect(location(response)).toBe(`${ORIGIN}/auth/login?redirect=${encodeURIComponent("/orgs/acme-coffee/dashboard")}`);
		expect(response.cookies.get(ACCESS_COOKIE)?.value).toBe("");
	});
});
