// ============================================
// lib/server-api.test.ts - SSR prefetch helper coverage
// ============================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	classifyError,
	createServerCaller,
	createServerCallerForRouter,
	createServerRequestContext,
	describeFailure,
	isNoteworthyPrefetchFailure,
	isPrefetchFailure,
	resolveConfig,
	type PrefetchLogEvent,
	type ServerApiConfig,
} from "./server-api";
import { LIST_SLOT_INDEX, singleResponse } from "@workspace/shared";

import { headersOf, type FetchImpl } from "../test-utils";
import { apiRouter, defineMutation, defineQuery, resolveRequest } from "./endpoints";
import { ApiResponseContractError } from "@workspace/api-client";

// `server-only` throws outside React Server Components; stub it for tests.
vi.mock("server-only", () => ({}));

// Mock `next/headers` so `cookies()` / `headers()` don't touch the request context.
// The cookie store also records writes: a Server Component cannot write
// cookies, so the SSR pipeline must never try (the old refresh did).
interface CookieStore {
	readonly get: (name: string) => { readonly value: string } | undefined;
	readonly set: (name: string, value: string) => void;
}
const cookiesMock = vi.fn<() => CookieStore>();
const headersMock = vi.fn<() => Promise<Headers>>();
vi.mock("next/headers", () => ({
	cookies: (): CookieStore => cookiesMock(),
	headers: (): Promise<Headers> => headersMock(),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const okResponse = singleResponse(z.object({ ok: z.literal("yes") }));
const OK_BODY = { success: true, data: { ok: "yes" }, meta: { correlationId: "corr-1", timestamp: 1786428000000 } };

/** Fixture GET def — the def factories infer the constrained Input/Resp generics, so no widening cast is needed. */
const endpoint = defineQuery({ method: "GET", path: "/geo/stats", input: z.object({}), response: okResponse }, { scope: () => ["geo", "stats"] });
const publicEndpoint = defineQuery(
	{ method: "GET", path: "/geo/stats", input: z.object({}), response: okResponse, access: "public" },
	{ scope: () => ["geo", "stats", "public"] },
);
const writeEndpoint = defineMutation({ method: "POST", path: "/geo/stats", input: z.object({}), response: okResponse });

const silent = (): void => undefined;

function testConfig(overrides: Partial<ServerApiConfig> = {}): ServerApiConfig {
	return {
		clientType: "admin",
		attemptTimeoutMs: 5_000,
		deadlineMs: 5_000,
		retries: 0,
		retryDelayMs: 1,
		retryJitterMs: 0,
		logger: silent,
		...overrides,
	};
}

function jsonResponse(body: object, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const cookieWrites = vi.fn<(name: string, value: string) => void>();

function cookieStoreWithAccess(value: string | undefined): CookieStore {
	return {
		get: (name: string): { readonly value: string } | undefined => {
			if (name === "adminAccessToken") return value === undefined ? undefined : { value };
			if (name === "adminRefreshToken") return { value: "refresh-token-value" };
			return undefined;
		},
		set: cookieWrites,
	};
}

beforeEach(() => {
	cookieWrites.mockReset();
	headersMock.mockResolvedValue(new Headers({ "user-agent": "vitest", "accept-language": "en-US", "x-forwarded-for": "203.0.113.7" }));
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

describe("resolveRequest", () => {
	it("appends input keys to the query string for GET", () => {
		const { url } = resolveRequest("/geo/countries", { page: 1, search: "united" }, { method: "GET" });
		expect(url).toBe("/geo/countries?page=1&search=united");
	});

	it("fills :params from the input and leaves the rest as query", () => {
		const { url } = resolveRequest("/geo/countries/:id", { id: "abc 123" }, { method: "GET" });
		expect(url).toBe("/geo/countries/abc%20123");
	});

	it("skips undefined values", () => {
		const { url } = resolveRequest("/geo/countries", { page: 1, search: undefined }, { method: "GET" });
		expect(url).toBe("/geo/countries?page=1");
	});

	it("routes mutation leftovers to the body and toQuery keys to the query", () => {
		const { url, body } = resolveRequest("/geo/countries", { name: "Test", limit: 10 }, { method: "POST", toQuery: ["limit"] });
		expect(url).toBe("/geo/countries?limit=10");
		expect(body).toEqual({ name: "Test" });
	});

	it("splits path params from the mutation body", () => {
		const { url, body } = resolveRequest("/geo/countries/:id", { id: "1", name: "Updated" }, { method: "PUT" });
		expect(url).toBe("/geo/countries/1");
		expect(body).toEqual({ name: "Updated" });
	});
});

describe("classifyError", () => {
	it("classifies an AbortError as aborted", () => {
		expect(classifyError(new DOMException("aborted", "AbortError"))).toEqual({ kind: "aborted" });
	});

	it("classifies a TimeoutError as timeout", () => {
		expect(classifyError(new DOMException("timed out", "TimeoutError"))).toEqual({ kind: "timeout" });
	});

	it("classifies a ZodError as schema", () => {
		expect(classifyError(new z.ZodError([])).kind).toBe("schema");
	});

	it("classifies a response-contract mismatch as schema, naming the first failing path", () => {
		const failure = classifyError(
			new ApiResponseContractError({ method: "GET", url: "http://api.test/api/v1/geo/stats", status: 200 }, [{ path: "data.ok", message: "Invalid input" }]),
		);
		expect(failure).toEqual({ kind: "schema", message: "data.ok: Invalid input" });
	});

	it("classifies a generic Error as unreachable with its message", () => {
		expect(classifyError(new Error("boom"))).toEqual({ kind: "unreachable", cause: "boom" });
	});

	it("classifies a rejection without an Error as an unclassified unreachable failure", () => {
		expect(classifyError(undefined)).toEqual({ kind: "unreachable", cause: "non-Error rejection" });
	});
});

describe("createServerCallerForRouter", () => {
	beforeEach(() => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
	});

	it("binds query leaves from a router tree without a manual literal", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(OK_BODY));
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock })));

		await expect(server.stats.query({})).resolves.toEqual(OK_BODY);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("is read-only: mutation leaves are not bound (writes belong to Server Actions or the browser)", () => {
		const server = createServerCallerForRouter({ stats: endpoint, write: writeEndpoint, nested: { write: writeEndpoint } }, createServerRequestContext(testConfig()));

		expect(Object.keys(server)).toEqual(["stats", "nested"]);
		expect(Object.keys(server.nested)).toEqual([]);
	});

	it("binds the real apiRouter without its mutations (no refresh / login leaves on the server)", () => {
		const server = createServerCaller({ clientType: "web" });

		expect("me" in server.auth).toBe(true);
		expect("refresh" in server.auth).toBe(false);
		expect("login" in server.auth).toBe(false);
	});

	it("forwards the frontend's cookie, client type and the browser's identity headers — and nothing can override them", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(OK_BODY));
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock })));

		await server.stats.query({});

		const headers = headersOf(fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second] ?? {});
		expect(headers.Cookie).toBe("adminAccessToken=access-token");
		expect(headers["X-Client-Type"]).toBe("admin");
		expect(headers["user-agent"]).toBe("vitest");
		expect(headers["x-forwarded-for"]).toBe("203.0.113.7");
	});

	it("rejects a prefetched body that violates the response contract with a typed error", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse({ ...OK_BODY, data: { ok: "no" } }));
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock })));

		await expect(server.stats.query({})).rejects.toBeInstanceOf(ApiResponseContractError);
	});
});

describe("a 401 during SSR never rotates the session", () => {
	beforeEach(() => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("expired-access-token"));
	});

	it("rejects with HTTP 401 after ONE request: no refresh call, no cookie write", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse({ success: false }, 401));
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock, retries: 3 })));

		await expect(server.stats.query({})).rejects.toThrow("HTTP 401");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
		expect(cookieWrites).not.toHaveBeenCalled();
	});
});

describe("prefetch outcomes are logged, never swallowed", () => {
	beforeEach(() => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
	});

	it("reports a success and a failure to the configured logger", async () => {
		const events: PrefetchLogEvent[] = [];
		const logger = (event: PrefetchLogEvent): void => {
			events.push(event);
		};
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse(OK_BODY))
			.mockResolvedValueOnce(jsonResponse({ success: false }, 503));
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock, logger })));

		await server.stats.query({});
		await expect(server.stats.query({})).rejects.toThrow("HTTP 503");

		expect(events.map((event) => event.outcome)).toEqual([{ ok: true }, { ok: false, failure: { kind: "http", status: 503 } }]);
		expect(events.every((event) => event.path === "/geo/stats")).toBe(true);
	});

	it("the default logger warns on an unexpected failure and stays quiet on expected ones", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(silent);
		const fetchMock = vi
			.fn<FetchImpl>()
			.mockResolvedValueOnce(jsonResponse({ success: false }, 500))
			.mockResolvedValueOnce(jsonResponse({ success: false }, 401));
		const config: ServerApiConfig = { ...resolveConfig({ clientType: "admin" }), fetchImpl: fetchMock, retries: 0 };
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(config));

		await expect(server.stats.query({})).rejects.toThrow("HTTP 500");
		await expect(server.stats.query({})).rejects.toThrow("HTTP 401");

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.first]).toContain("HTTP 500");
		warn.mockRestore();
	});
});

describe("timeouts", () => {
	beforeEach(() => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
	});

	/**
	 * A fetch that never answers until its signal aborts — then rejects with the signal's reason, like the platform fetch.
	 * Also like the platform fetch, a signal that is ALREADY aborted rejects at once: an attempt can start after the
	 * deadline fired (both timers overdue in one timer phase under load), and its signal never emits `abort` again.
	 */
	function hangingFetch(): FetchImpl {
		return (_input, init): Promise<Response> =>
			new Promise((_resolve, reject): void => {
				const signal: AbortSignal | null | undefined = init?.signal;
				const rejectWithReason = (): void => {
					const reason: Error | undefined = signal?.reason instanceof Error ? signal.reason : undefined;
					reject(reason ?? new DOMException("aborted", "AbortError"));
				};
				if (signal?.aborted === true) {
					rejectWithReason();
					return;
				}
				signal?.addEventListener("abort", rejectWithReason, { once: true });
			});
	}

	it("rejects at once, without a request hanging, when an attempt starts on an already-aborted signal", async () => {
		const fetchMock = vi.fn<FetchImpl>(hangingFetch());
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock, retries: 10 })));

		await expect(server.stats.query({}, { signal: AbortSignal.abort() })).rejects.toThrow("aborted");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("retries an attempt that timed out, within the overall deadline", async () => {
		const fetchMock = vi.fn<FetchImpl>(hangingFetch()).mockImplementationOnce(hangingFetch()).mockResolvedValueOnce(jsonResponse(OK_BODY));
		const server = createServerCallerForRouter(
			{ stats: endpoint },
			createServerRequestContext(testConfig({ fetchImpl: fetchMock, attemptTimeoutMs: 20, deadlineMs: 2_000, retries: 2 })),
		);

		await expect(server.stats.query({})).resolves.toEqual(OK_BODY);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("gives up as a timeout once the overall deadline passes, however many retries are left", async () => {
		const fetchMock = vi.fn<FetchImpl>(hangingFetch());
		const events: PrefetchLogEvent[] = [];
		const server = createServerCallerForRouter(
			{ stats: endpoint },
			createServerRequestContext(
				testConfig({
					fetchImpl: fetchMock,
					attemptTimeoutMs: 30,
					deadlineMs: 50,
					retries: 10,
					logger: (event: PrefetchLogEvent): void => {
						events.push(event);
					},
				}),
			),
		);

		await expect(server.stats.query({})).rejects.toThrow("timeout");
		expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(2);
		expect(events[LIST_SLOT_INDEX.first]?.outcome).toEqual({ ok: false, failure: { kind: "timeout" } });
	});
});

describe("server queries without a session cookie", () => {
	beforeEach(() => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess(undefined));
	});

	it("skips a route that needs a session (no request is made)", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(OK_BODY));
		const server = createServerCallerForRouter({ stats: endpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock })));

		await expect(server.stats.query({})).rejects.toThrow("no access-token cookie");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fetches a public route anonymously — no Cookie header — so guests get server-rendered data", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(jsonResponse(OK_BODY));
		const server = createServerCallerForRouter({ stats: publicEndpoint }, createServerRequestContext(testConfig({ fetchImpl: fetchMock })));

		await expect(server.stats.query({})).resolves.toEqual(OK_BODY);
		const headers = new Headers(fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]?.headers);
		expect(headers.has("cookie")).toBe(false);
		expect(headers.get("x-client-type")).toBe("admin");
	});

	it("carries the contract's access onto the query def (authenticated by default)", () => {
		expect(endpoint.access).toBe("authenticated");
		expect(publicEndpoint.access).toBe("public");
		expect(apiRouter.rewards.list.access).toBe("public");
		expect(apiRouter.claims.list.access).toBe("authenticated");
	});
});

describe("resolveConfig", () => {
	it("requires the frontend's client type and fills in the library defaults", () => {
		const config = resolveConfig({ clientType: "merchant" });
		expect(config.clientType).toBe("merchant");
		expect(config.retries).toBeGreaterThanOrEqual(0);
		expect(config.deadlineMs).toBeGreaterThanOrEqual(config.attemptTimeoutMs);
	});

	it("merges partial overrides onto the defaults", () => {
		expect(resolveConfig({ clientType: "web", attemptTimeoutMs: 999 }).attemptTimeoutMs).toBe(999);
	});

	it("rejects a deadline shorter than one attempt (retries could never run)", () => {
		expect(() => resolveConfig({ clientType: "web", attemptTimeoutMs: 1_000, deadlineMs: 500 })).toThrow(/deadlineMs/);
	});
});

describe("helpers", () => {
	it("describeFailure returns a readable one-liner", () => {
		expect(describeFailure({ kind: "http", status: 500 })).toBe("HTTP 500");
		expect(describeFailure({ kind: "timeout" })).toBe("timed out");
		expect(describeFailure({ kind: "no-cookie" })).toBe("no access-token cookie");
	});

	it("isPrefetchFailure narrows the union", () => {
		expect(isPrefetchFailure({ kind: "http", status: 404 })).toBe(true);
		expect(isPrefetchFailure({ kind: "nope" })).toBe(false);
		expect(isPrefetchFailure({})).toBe(false);
	});

	it("treats a guest, an expired access token and an abort as expected — everything else is noteworthy", () => {
		expect(isNoteworthyPrefetchFailure({ kind: "no-cookie" })).toBe(false);
		expect(isNoteworthyPrefetchFailure({ kind: "http", status: 401 })).toBe(false);
		expect(isNoteworthyPrefetchFailure({ kind: "aborted" })).toBe(false);
		expect(isNoteworthyPrefetchFailure({ kind: "http", status: 403 })).toBe(true);
		expect(isNoteworthyPrefetchFailure({ kind: "unreachable", cause: "ECONNREFUSED" })).toBe(true);
		expect(isNoteworthyPrefetchFailure({ kind: "timeout" })).toBe(true);
	});
});
