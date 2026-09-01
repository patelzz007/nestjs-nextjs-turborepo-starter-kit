import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import {
	collectSetCookies,
	createProxyRefreshCooldown,
	hasRouteSession,
	isAccessTokenExpired,
	isDocumentNavigation,
	logProxyRefresh,
	parseSetCookie,
	refreshSessionFromProxy,
	PROXY_REFRESH_COOLDOWN_MS,
	REFRESH_TIMEOUT_MS,
	type ProxyRefreshResult,
} from "./proxy-refresh";
import { headersOf, inputUrl } from "../test-utils";

type StubFetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>;

/** Build a JWT string from a payload (base64url header/payload, dummy signature). */
function makeJwt(payload: Record<string, unknown>): string {
	const encode = (value: unknown): string => btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${encode({ alg: "none", typ: "JWT" })}.${encode(payload)}.signature`;
}

function stubFetch(impl: StubFetchImpl): Mock<StubFetchImpl> {
	const mock = vi.fn<StubFetchImpl>(impl);
	vi.stubGlobal("fetch", mock);
	return mock;
}

function responseWithCookies(status: number, setCookies: readonly string[]): Response {
	const headers = new Headers();
	for (const header of setCookies) headers.append("set-cookie", header);
	return new Response(JSON.stringify({ success: true }), { status, headers });
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("isAccessTokenExpired", () => {
	it("returns true when the token is already expired", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
		expect(isAccessTokenExpired(token)).toBe(true);
	});

	it("returns false when the token is well within its lifetime", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
		expect(isAccessTokenExpired(token)).toBe(false);
	});

	it("returns true when expiry falls inside the skew window", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 15 });
		expect(isAccessTokenExpired(token, 30_000)).toBe(true);
	});

	it("respects a custom skew", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 60 });
		expect(isAccessTokenExpired(token, 120_000)).toBe(true);
		expect(isAccessTokenExpired(token, 0)).toBe(false);
	});

	it("returns false when the payload has no exp claim", () => {
		const token = makeJwt({ sub: "u_1" });
		expect(isAccessTokenExpired(token)).toBe(false);
	});

	it("returns false for malformed or undecodable tokens", () => {
		expect(isAccessTokenExpired("not-a-jwt")).toBe(false);
		expect(isAccessTokenExpired("a.b.c.d")).toBe(false);
		expect(isAccessTokenExpired("")).toBe(false);
	});
});

describe("hasRouteSession", () => {
	it("returns true for a live access token", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
		expect(hasRouteSession(token, undefined, token)).toBe(true);
	});

	it("returns false for an expired access token with no refresh token", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
		expect(hasRouteSession(token, undefined, token)).toBe(false);
	});

	it("returns true for an expired access token when a refresh token is present", () => {
		const token = makeJwt({ exp: Math.floor(Date.now() / 1000) - 60 });
		expect(hasRouteSession(token, "rt", token)).toBe(true);
	});

	it("returns true when only a refresh token is present", () => {
		expect(hasRouteSession(undefined, "rt", undefined)).toBe(true);
	});
});

describe("parseSetCookie", () => {
	it("parses name, value and all attributes", () => {
		const parsed = parseSetCookie("accessToken=abc123; Path=/; HttpOnly; Secure; SameSite=Lax");
		expect(parsed).toEqual({
			name: "accessToken",
			value: "abc123",
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
			domain: null,
			maxAge: null,
			expires: null,
		});
	});

	it("normalises SameSite values", () => {
		expect(parseSetCookie("a=b; SameSite=Strict")?.sameSite).toBe("strict");
		expect(parseSetCookie("a=b; SameSite=None")?.sameSite).toBe("none");
		expect(parseSetCookie("a=b; SameSite=Bogus")?.sameSite).toBe("lax");
	});

	it("is case-insensitive for attribute names", () => {
		expect(parseSetCookie("a=b; httponly; secure")?.httpOnly).toBe(true);
		expect(parseSetCookie("a=b; httponly; secure")?.secure).toBe(true);
	});

	it("applies defaults when attributes are missing", () => {
		const parsed = parseSetCookie("refreshToken=xyz");
		expect(parsed).toEqual({
			name: "refreshToken",
			value: "xyz",
			httpOnly: false,
			secure: false,
			sameSite: "lax",
			path: "/",
			domain: null,
			maxAge: null,
			expires: null,
		});
	});

	it("parses Max-Age and Expires attributes", () => {
		const parsed = parseSetCookie("refreshToken=xyz; Max-Age=604800; Expires=Wed, 21 Oct 2026 07:28:00 GMT");
		expect(parsed?.maxAge).toBe(604800);
		expect(parsed?.expires).toBeInstanceOf(Date);
		expect(parsed?.expires?.toUTCString()).toBe("Wed, 21 Oct 2026 07:28:00 GMT");
	});

	it("treats Max-Age=0 as a deletion (not null)", () => {
		expect(parseSetCookie("refreshToken=; Max-Age=0")?.maxAge).toBe(0);
	});

	it("ignores malformed Max-Age / Expires values", () => {
		expect(parseSetCookie("a=b; Max-Age=abc")?.maxAge).toBeNull();
		expect(parseSetCookie("a=b; Expires=not-a-date")?.expires).toBeNull();
	});

	it("reads an explicit path", () => {
		expect(parseSetCookie("a=b; Path=/admin")?.path).toBe("/admin");
	});

	it("reads a domain when the API emits one", () => {
		expect(parseSetCookie("a=b; Domain=.example.com")?.domain).toBe(".example.com");
	});

	it("returns null for malformed headers", () => {
		expect(parseSetCookie("noequals")).toBeNull();
		expect(parseSetCookie("")).toBeNull();
		expect(parseSetCookie("=value")).toBeNull();
	});
});

describe("isDocumentNavigation", () => {
	function headers(entries: Record<string, string>): { get(name: string): string | null } {
		return {
			get: (name: string): string | null => entries[name] ?? null,
		};
	}

	it("returns true for sec-fetch-mode: navigate", () => {
		expect(isDocumentNavigation(headers({ "sec-fetch-mode": "navigate" }))).toBe(true);
	});

	it("returns true when accept includes text/html (older browsers)", () => {
		expect(isDocumentNavigation(headers({ accept: "text/html,application/xhtml+xml" }))).toBe(true);
	});

	it("returns false for RSC / prefetch data requests", () => {
		expect(isDocumentNavigation(headers({ "sec-fetch-mode": "cors", accept: "*/*" }))).toBe(false);
	});

	it("returns false when no identifying headers are present", () => {
		expect(isDocumentNavigation(headers({}))).toBe(false);
	});
});

describe("collectSetCookies", () => {
	it("returns the native getSetCookie() results when available", () => {
		const headers = new Headers();
		headers.append("set-cookie", "a=1; Path=/; HttpOnly");
		headers.append("set-cookie", "b=2; Path=/");
		expect(collectSetCookies(headers)).toEqual(["a=1; Path=/; HttpOnly", "b=2; Path=/"]);
	});

	it("falls back to splitting get('set-cookie') when getSetCookie is unavailable", () => {
		const headers = {
			get: (name: string): string | null => (name === "set-cookie" ? "a=1; Path=/; HttpOnly, b=2; Path=/" : null),
		};
		expect(collectSetCookies(headers)).toEqual(["a=1; Path=/; HttpOnly", "b=2; Path=/"]);
	});

	it("returns an empty array when no set-cookie headers are present", () => {
		expect(collectSetCookies({ get: (): string | null => null })).toEqual([]);
	});
});

describe("logProxyRefresh", () => {
	it("is silent under vitest so proxy tests stay quiet", () => {
		const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		try {
			logProxyRefresh({ app: "web", pathname: "/hello", status: 200, elapsedMs: 12, outcome: "refreshed", rotatedCookieCount: 2 });
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it("logs the outcome on the server runtime", () => {
		vi.stubEnv("NODE_ENV", "development");
		const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		try {
			logProxyRefresh({ app: "admin", pathname: "/", status: 401, elapsedMs: 8, outcome: "dead-session", rotatedCookieCount: 0 });
			expect(spy).toHaveBeenCalledWith(expect.stringContaining("[proxy:admin]"));
			expect(spy).toHaveBeenCalledWith(expect.stringContaining("dead-session"));
			expect(spy).toHaveBeenCalledWith(expect.stringContaining("API 401, 8ms"));
		} finally {
			spy.mockRestore();
			vi.unstubAllEnvs();
		}
	});

	it("includes the underlying error detail for transient failures", () => {
		vi.stubEnv("NODE_ENV", "development");
		const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		try {
			logProxyRefresh({
				app: "web",
				pathname: "/hello",
				status: 0,
				elapsedMs: 8,
				outcome: "transient-failure",
				rotatedCookieCount: 0,
				errorDetail: "connect ECONNREFUSED 127.0.0.1:8080",
			});
			expect(spy).toHaveBeenCalledWith(expect.stringContaining("transient-failure"));
			expect(spy).toHaveBeenCalledWith(expect.stringContaining("connect ECONNREFUSED 127.0.0.1:8080"));
			expect(spy).toHaveBeenCalledWith(expect.stringContaining("API 0, 8ms"));
		} finally {
			spy.mockRestore();
			vi.unstubAllEnvs();
		}
	});

	it("omits the error detail when the refresh succeeded", () => {
		vi.stubEnv("NODE_ENV", "development");
		const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		try {
			logProxyRefresh({ app: "web", pathname: "/hello", status: 200, elapsedMs: 12, outcome: "refreshed", rotatedCookieCount: 2 });
			const message = String(spy.mock.calls[0]?.[0]);
			expect(message).toContain("rotated 2 cookie(s)");
			expect(message).not.toContain("ECONNREFUSED");
		} finally {
			spy.mockRestore();
			vi.unstubAllEnvs();
		}
	});
});

// ── Transient-failure cooldown ─────────────────────────────────────────────

describe("createProxyRefreshCooldown", () => {
	type RefreshAttempt = (token: string) => Promise<ProxyRefreshResult>;

	function failure(status: number, errorDetail?: string): ProxyRefreshResult {
		return { ok: false, status, setCookies: [], errorDetail };
	}

	function attemptMock(impl: RefreshAttempt): Mock<RefreshAttempt> {
		return vi.fn<RefreshAttempt>(impl);
	}

	it("memoizes a transient failure so follow-up calls skip without a network call", async () => {
		vi.useFakeTimers();
		try {
			const attempt = attemptMock(() => Promise.resolve(failure(0, "ECONNREFUSED")));
			const attemptRefresh = createProxyRefreshCooldown(attempt);

			const first = await attemptRefresh("rt");
			const second = await attemptRefresh("rt");

			expect(first.skipped).toBeUndefined();
			expect(attempt).toHaveBeenCalledTimes(1);
			expect(second).toEqual({ ok: false, status: 0, setCookies: [], skipped: true });
		} finally {
			vi.useRealTimers();
		}
	});

	it("retries once the cooldown window has elapsed", async () => {
		vi.useFakeTimers();
		try {
			let calls = 0;
			const attempt = attemptMock((): Promise<ProxyRefreshResult> => {
				calls += 1;
				return calls === 1 ? Promise.resolve(failure(0, "ECONNREFUSED")) : Promise.resolve({ ok: true, status: 200, setCookies: ["accessToken=new; Path=/"] });
			});
			const attemptRefresh = createProxyRefreshCooldown(attempt);

			await attemptRefresh("rt");
			await vi.advanceTimersByTimeAsync(PROXY_REFRESH_COOLDOWN_MS + 1);
			const retry = await attemptRefresh("rt");

			expect(retry.ok).toBe(true);
			expect(calls).toBe(2);
		} finally {
			vi.useRealTimers();
		}
	});

	it("clears the cooldown on a success", async () => {
		// Each test creates its own cooldown instance (fresh closure), so there
		// is no cross-test bleed in this describe block. The success reset is
		// only observable once the cooldown window has elapsed, so we advance
		// the clock past it before the recovering call.
		vi.useFakeTimers();
		try {
			vi.setSystemTime(1_700_000_000_000);
			let calls = 0;
			const attempt = attemptMock((): Promise<ProxyRefreshResult> => {
				calls += 1;
				return calls === 1 ? Promise.resolve(failure(0, "ECONNREFUSED")) : Promise.resolve({ ok: true, status: 200, setCookies: [] });
			});
			const attemptRefresh = createProxyRefreshCooldown(attempt, 60_000);

			await attemptRefresh("rt");
			// Move past the 60s window, then recover: the API is healthy again,
			// so the refresh succeeds — and the success resets the memoization.
			await vi.advanceTimersByTimeAsync(60_001);
			const second = await attemptRefresh("rt");

			expect(second.ok).toBe(true);
			expect(second.skipped).toBeUndefined();
			expect(calls).toBe(2);

			// A follow-up failure still arms a fresh cooldown (the success above
			// did not leave stale state behind).
			const third = await attemptRefresh("rt");
			expect(third.skipped).toBeUndefined();
			expect(calls).toBe(3);
		} finally {
			vi.useRealTimers();
		}
	});

	it("never memoizes a dead-session (401) so login still happens on every navigation", async () => {
		const attempt = attemptMock(() => Promise.resolve(failure(401)));
		const attemptRefresh = createProxyRefreshCooldown(attempt);

		const first = await attemptRefresh("rt-dead");
		const second = await attemptRefresh("rt-dead");

		expect(first.skipped).toBeUndefined();
		expect(second.skipped).toBeUndefined();
		expect(attempt).toHaveBeenCalledTimes(2);
	});
});

// ── Server-side refresh ─────────────────────────────────────────────────────

describe("refreshSessionFromProxy", () => {
	const webConfig = {
		apiBaseUrl: "http://api.test",
		refreshTokenName: "refreshToken",
		refreshToken: "rt-value",
		clientType: "web" as const,
	};

	it("calls POST /auth/refresh with the refresh cookie and no client header for web", async () => {
		const fetchMock = stubFetch(() =>
			responseWithCookies(200, ["accessToken=new-at; Path=/; HttpOnly; Secure; SameSite=Lax", "refreshToken=new-rt; Path=/; HttpOnly; Secure; SameSite=Lax"]),
		);

		const result = await refreshSessionFromProxy(webConfig);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const call = fetchMock.mock.calls[0];
		if (call === undefined) throw new Error("fetch was never called");
		const [input, init] = call;
		expect(inputUrl(input)).toBe("http://api.test/api/v1/auth/refresh");
		expect(init?.method).toBe("POST");
		expect(headersOf(init ?? {}).Cookie).toBe("refreshToken=rt-value");
		expect(headersOf(init ?? {})["X-Client-Type"]).toBeUndefined();

		expect(result.ok).toBe(true);
		expect(result.setCookies).toHaveLength(2);
	});

	it("sends X-Client-Type: admin for admin sessions", async () => {
		const fetchMock = stubFetch(() => responseWithCookies(200, ["adminAccessToken=new-at; Path=/; HttpOnly"]));

		const result = await refreshSessionFromProxy({
			...webConfig,
			refreshTokenName: "adminRefreshToken",
			refreshToken: "admin-rt",
			clientType: "admin",
		});

		expect(result.ok).toBe(true);
		const call = fetchMock.mock.calls[0];
		if (call === undefined) throw new Error("fetch was never called");
		const [input, init] = call;
		const headers = headersOf(init ?? {});
		expect(headers["X-Client-Type"]).toBe("admin");
		expect(headers.Cookie).toBe("adminRefreshToken=admin-rt");
		expect(inputUrl(input)).toBe("http://api.test/api/v1/auth/refresh");
	});

	it("sends X-Client-Type: merchant with isolated merchant refresh cookies", async () => {
		const fetchMock = stubFetch(() => responseWithCookies(200, ["merchantAccessToken=new-at; Path=/; HttpOnly"]));

		const result = await refreshSessionFromProxy({
			...webConfig,
			refreshTokenName: "merchantRefreshToken",
			refreshToken: "merchant-rt",
			clientType: "merchant",
		});

		expect(result.ok).toBe(true);
		const call = fetchMock.mock.calls[0];
		if (call === undefined) throw new Error("fetch was never called");
		const [input, init] = call;
		const headers = headersOf(init ?? {});
		expect(headers["X-Client-Type"]).toBe("merchant");
		expect(headers.Cookie).toBe("merchantRefreshToken=merchant-rt");
		expect(inputUrl(input)).toBe("http://api.test/api/v1/auth/refresh");
	});

	it("surfaces non-2xx statuses without throwing", async () => {
		stubFetch(() => new Response("Unauthorized", { status: 401 }));

		const result = await refreshSessionFromProxy(webConfig);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(401);
		expect(result.setCookies).toEqual([]);
	});

	it("maps network failures to ok:false with status 0 and surfaces the cause", async () => {
		const cause = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8080"), { code: "ECONNREFUSED" });
		stubFetch(() => {
			throw new TypeError("fetch failed", { cause });
		});

		const result = await refreshSessionFromProxy(webConfig);

		expect(result.ok).toBe(false);
		expect(result.status).toBe(0);
		expect(result.setCookies).toEqual([]);
		expect(result.errorDetail).toBe("connect ECONNREFUSED 127.0.0.1:8080");
	});

	it("aborts and fails gracefully when the API exceeds the timeout", async () => {
		vi.useFakeTimers();
		try {
			const fetchMock = stubFetch(
				(_input, init) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () => {
							reject(new DOMException("Aborted", "AbortError"));
						});
					}),
			);

			const promise = refreshSessionFromProxy(webConfig);
			await vi.advanceTimersByTimeAsync(REFRESH_TIMEOUT_MS + 1);

			const result = await promise;

			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(result.ok).toBe(false);
			expect(result.status).toBe(0);
			expect(result.setCookies).toEqual([]);
			expect(result.errorDetail).toBe("Aborted");
		} finally {
			vi.useRealTimers();
		}
	});
});
