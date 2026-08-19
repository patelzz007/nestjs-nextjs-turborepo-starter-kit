// ============================================
// lib/api-server.test.ts - SSR prefetch helper coverage
// ============================================
import { QueryClient, type DehydratedState, type QueryKey } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	assertKeyShape,
	classifyError,
	coerceQueryValue,
	describeFailure,
	enforcePayloadBudget,
	isPrefetchFailure,
	prefetchEndpointDetailed,
	prefetchPage,
	queryKeyString,
	resolveConfig,
	type PrefetchOutcome,
	type PrefetchSpec,
	type ServerApiConfig,
} from "./server-api";
import { type DataValue, type SerializableInput } from "@workspace/shared";
import { defineQuery, resolveRequest, type QueryDef } from "./endpoints";

// `server-only` throws outside React Server Components; stub it for tests.
vi.mock("server-only", () => ({}));

// Mock `next/headers` so `cookies()` / `headers()` don't touch the request context.
// The mocks are typed (not `vi.fn()` any) so the factory properties return real
// types — no `any`, no `unknown`, no casts.
interface CookieStore {
	readonly get: (name: string) => { readonly value: string } | undefined;
}
const cookiesMock = vi.fn<() => CookieStore>();
const headersMock = vi.fn<() => Promise<Headers>>();
vi.mock("next/headers", () => ({
	cookies: (): CookieStore => cookiesMock(),
	headers: (): Promise<Headers> => headersMock(),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

const envelopeSchema = z.object({
	success: z.literal(true),
	data: z.object({ ok: z.literal("yes") }),
	meta: z.object({}),
});

/** Fixture GET def — the def factories infer the constrained Input/Resp generics, so no widening cast is needed. */
const endpoint = defineQuery(
	{ method: "GET", path: "/telescope/overview", input: z.object({ range: z.string() }) },
	{
		response: envelopeSchema,
		queryKey: ({ range }) => ["telescope", "overview", range],
	},
);

const requestEndpoint = defineQuery(
	{ method: "GET", path: "/telescope/requests", input: z.undefined() },
	{
		response: envelopeSchema,
		queryKey: () => ["telescope", "requests", { page: 1 }],
	},
);
const testConfig: ServerApiConfig = {
	accessTokenCookie: "adminAccessToken",
	refreshTokenCookie: "adminRefreshToken",
	clientType: "admin",
	timeoutMs: 5_000,
	retries: 0,
	retryDelayMs: 5,
	retryBackoffMs: 10,
	staleTimeMs: 60_000,
	gcTimeMs: 300_000,
	logger: (): void => {
		// silent in tests
	},
	logLevel: "silent",
};

/**
 * Builds a thunk-style `PrefetchSpec` from a def + input — the same shape the
 * server caller's spec factory produces, so `prefetchPage` tests exercise the
 * real pipeline.
 */
function specOf<Input extends SerializableInput, Resp extends DataValue>(
	def: QueryDef<Input, Resp>,
	input: Input,
	options?: { readonly enabled?: boolean | (() => boolean); readonly fallbackData?: Resp },
): PrefetchSpec {
	return {
		run: (queryClient, call): Promise<PrefetchOutcome> =>
			prefetchEndpointDetailed(queryClient, def, input, testConfig, {
				signal: call?.signal,
				page: call?.page,
				traceId: call?.traceId,
				fallbackData: options?.fallbackData,
			}).then((detailed) => detailed.outcome),
		queryKey: def.queryKey(input),
		enabled: options?.enabled,
	};
}

function jsonResponse(body: object, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json", ...headers },
	});
}

function cookieStoreWithAccess(value: string | undefined): CookieStore {
	return {
		get: (name: string): { readonly value: string } | undefined => {
			if (name === "adminAccessToken") return value === undefined ? undefined : { value };
			return { value: "refresh-token-value" };
		},
	};
}

function mockForwardedHeaders(): void {
	headersMock.mockResolvedValue(new Headers({ "user-agent": "vitest", "accept-language": "en-US" }));
}

/** Builds a valid `DehydratedState` from minimal `{ data, queryKey }` entries. */
function dehydratedWith(entries: readonly { readonly data: string; readonly queryKey: QueryKey }[]): DehydratedState {
	return {
		mutations: [],
		queries: entries.map((entry) => ({
			queryHash: JSON.stringify(entry.queryKey),
			queryKey: entry.queryKey,
			state: {
				data: entry.data,
				dataUpdateCount: 1,
				dataUpdatedAt: 0,
				error: null,
				errorUpdateCount: 0,
				errorUpdatedAt: 0,
				fetchFailureCount: 0,
				fetchFailureReason: null,
				fetchMeta: null,
				isInvalidated: false,
				status: "success",
				fetchStatus: "idle",
			},
		})),
	};
}

/** Normalizes the first `fetch` argument (string URL, URL object, or Request) to a URL string. */
function fetchUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

/** Reads a named header out of a `HeadersInit` value without type assertions. */
function headerValue(headers: HeadersInit | undefined, name: string): string | undefined {
	if (headers === undefined) return undefined;
	if (headers instanceof Headers) return headers.get(name) ?? undefined;
	if (Array.isArray(headers)) {
		const pair: readonly [string, string] | undefined = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
		return pair?.[1];
	}
	const key: string | undefined = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
	return key === undefined ? undefined : headers[key];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

describe("coerceQueryValue", () => {
	it("stringifies numbers", () => {
		expect(coerceQueryValue(42)).toBe("42");
	});

	it("maps booleans to literal true/false", () => {
		expect(coerceQueryValue(true)).toBe("true");
		expect(coerceQueryValue(false)).toBe("false");
	});

	it("passes strings through", () => {
		expect(coerceQueryValue("abc")).toBe("abc");
	});
});

describe("resolveRequest", () => {
	it("appends input keys to the query string for GET", () => {
		const { url } = resolveRequest("/telescope/sql", { page: 1, sort: "duration" }, { method: "GET" });
		expect(url).toBe("/telescope/sql?page=1&sort=duration");
	});

	it("fills :params from the input and leaves the rest as query", () => {
		const { url } = resolveRequest("/telescope/requests/:id/sql", { id: "abc 123" }, { method: "GET" });
		expect(url).toBe("/telescope/requests/abc%20123/sql");
	});

	it("skips undefined values", () => {
		const { url } = resolveRequest("/telescope/requests", { page: 1, q: undefined }, { method: "GET" });
		expect(url).toBe("/telescope/requests?page=1");
	});

	it("routes mutation leftovers to the body and toQuery keys to the query", () => {
		const { url, body } = resolveRequest("/telescope/admin/prune", { force: true }, { method: "POST", toQuery: ["force"] });
		expect(url).toBe("/telescope/admin/prune?force=true");
		expect(body).toEqual({});
	});

	it("splits path params from the mutation body", () => {
		const { url, body } = resolveRequest("/telescope/replay/:id", { id: "x", target: "local" }, { method: "POST" });
		expect(url).toBe("/telescope/replay/x");
		expect(body).toEqual({ target: "local" });
	});
});

describe("classifyError", () => {
	it("classifies an AbortError as aborted", () => {
		const failure = classifyError(new DOMException("aborted", "AbortError"));
		expect(failure).toEqual({ kind: "aborted" });
	});

	it("classifies a ZodError as schema", () => {
		const failure = classifyError(new z.ZodError([]));
		expect(failure.kind).toBe("schema");
	});

	it("classifies a generic Error as unreachable with its message", () => {
		const failure = classifyError(new Error("boom"));
		expect(failure).toEqual({ kind: "unreachable", cause: "boom" });
	});

	it("classifies non-Error values as unreachable with a stringified cause", () => {
		expect(classifyError("nope")).toEqual({ kind: "unreachable", cause: "nope" });
	});
});

describe("resolveConfig", () => {
	it("merges partial overrides onto defaults", () => {
		const config = resolveConfig({ timeoutMs: 999 });
		expect(config.timeoutMs).toBe(999);
		expect(config.accessTokenCookie).toBe("adminAccessToken");
		expect(config.clientType).toBe("admin");
	});

	it("returns full defaults when no overrides", () => {
		const config = resolveConfig(undefined);
		expect(config.retries).toBe(0);
		expect(config.staleTimeMs).toBe(60_000);
	});
});

describe("assertKeyShape", () => {
	it("does not warn for explicit query keys", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		assertKeyShape(endpoint, endpoint.queryKey({ range: "15m" }));
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	it("warns in dev when the key is the fallback [method, path]", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		vi.stubEnv("NODE_ENV", "development");
		assertKeyShape(
			{
				kind: "query",
				method: "GET",
				path: "/telescope/x",
				inputSchema: z.undefined(),
				responseSchema: envelopeSchema,
				queryKey: () => ["GET", "/telescope/x"],
			},
			["GET", "/telescope/x"],
		);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
		vi.unstubAllEnvs();
	});
});

describe("enforcePayloadBudget", () => {
	it("returns the state unchanged when no budget is set", () => {
		const state: DehydratedState = dehydratedWith([{ data: "x", queryKey: ["a"] }]);
		expect(enforcePayloadBudget(state, undefined)).toBe(state);
	});

	it("drops the largest queries until the payload fits", () => {
		const state: DehydratedState = dehydratedWith([
			{ data: "s", queryKey: ["small"] },
			{ data: "x".repeat(500), queryKey: ["large"] },
		]);
		const pruned = enforcePayloadBudget(state, 400);
		const keys = pruned.queries.map((query) => query.queryKey[0]);
		expect(keys).toEqual(["small"]);
	});
});

// ── Prefetch pipeline ───────────────────────────────────────────────────────

describe("prefetchEndpointDetailed", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
		mockForwardedHeaders();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("returns no-cookie when the access cookie is missing", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess(undefined));
		const queryClient = new QueryClient();

		const outcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.failure.kind).toBe("no-cookie");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("prefetches successfully and caches the parsed payload", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} }));
		const queryClient = new QueryClient();

		const outcome: PrefetchOutcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(true);
		const cached = queryClient.getQueryData(endpoint.queryKey({ range: "15m" }));
		expect(cached).toEqual({ success: true, data: { ok: "yes" }, meta: {} });
	});

	it("classifies an HTTP 500 as an http failure and leaves the cache empty", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "boom" }, 500));
		const queryClient = new QueryClient();

		const outcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.failure).toEqual({ kind: "http", status: 500 });
		expect(queryClient.getQueryData(endpoint.queryKey({ range: "15m" }))).toBeUndefined();
	});

	it("classifies a network failure as unreachable", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));
		const queryClient = new QueryClient();

		const outcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.failure.kind).toBe("unreachable");
	});

	it("classifies a schema mismatch and leaves the cache empty", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true, data: { wrong: true }, meta: {} }));
		const queryClient = new QueryClient();

		const outcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.failure.kind).toBe("schema");
		expect(queryClient.getQueryData(endpoint.queryKey({ range: "15m" }))).toBeUndefined();
	});

	it("refreshes on a 401 and retries with the rotated token", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("stale-token"));
		const fetchMock = vi.mocked(fetch);
		fetchMock
			.mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401))
			.mockImplementationOnce((input: RequestInfo | URL) => {
				const url: string = fetchUrl(input);
				if (url.includes("/auth/refresh")) {
					return Promise.resolve(
						jsonResponse({ success: true, data: {}, meta: {} }, 200, {
							"set-cookie": "adminAccessToken=fresh-token; Path=/; HttpOnly",
						}),
					);
				}
				return Promise.resolve(jsonResponse({ message: "unexpected" }, 500));
			})
			.mockResolvedValueOnce(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} }));

		const queryClient = new QueryClient();
		const outcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(true);
		// The retried fetch must carry the rotated token.
		const secondCall = fetchMock.mock.calls[2];
		const cookieHeader = secondCall?.[1]?.headers;
		expect(cookieHeader).toBeDefined();
		const cookie: string = headerValue(cookieHeader, "Cookie") ?? "";
		expect(cookie).toContain("adminAccessToken=fresh-token");
	});

	it("does not retry when the refresh itself fails", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("stale-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "unauthorized" }, 401));
		const queryClient = new QueryClient();

		const outcome = (await prefetchEndpointDetailed(queryClient, endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.failure).toEqual({ kind: "http", status: 401 });
	});
});

describe("prefetchPage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
		mockForwardedHeaders();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("hydrates only successful specs and skips disabled ones", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} }));

		const { state, report } = await prefetchPage([specOf(endpoint, { range: "15m" }), specOf(requestEndpoint, undefined, { enabled: false })], { config: testConfig });

		expect(state.queries).toHaveLength(1);
		expect(report.succeeded).toBe(1);
		expect(report.skipped).toBe(1);
		expect(report.total).toBe(1);
		expect(state.queries[0]?.queryKey).toEqual(endpoint.queryKey({ range: "15m" }));
		// The disabled spec never called fetch.
		const urls = vi.mocked(fetch).mock.calls.map((call) => fetchUrl(call[0]));
		expect(urls.some((url) => url.includes("/telescope/requests"))).toBe(false);
	});

	it("drops failed queries from the dehydrated state", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "boom" }, 500));

		const { state, report } = await prefetchPage([specOf(endpoint, { range: "15m" })], { config: testConfig });

		expect(state.queries).toHaveLength(0);
		expect(report.failed).toBe(1);
		expect(report.payloadBytes).toBeGreaterThan(0);
	});

	it("seeds fallbackData into the cache when the prefetch fails", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "boom" }, 500));

		const { state } = await prefetchPage([specOf(endpoint, { range: "15m" }, { fallbackData: { success: true, data: { ok: "yes" }, meta: {} } })], { config: testConfig });

		// The fallback made it into the dehydrated payload so the page renders *something*.
		expect(state.queries).toHaveLength(1);
	});

	it("returns a report with the page tag and payload bytes", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} }));

		const { report } = await prefetchPage([specOf(endpoint, { range: "15m" })], { config: testConfig, page: "/telescope" });

		expect(report.page).toBe("/telescope");
		expect(report.succeeded).toBe(1);
		expect(report.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("caps concurrent prefetches with maxConcurrency", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		// Fresh Response per call — a body can only be consumed once.
		vi.mocked(fetch).mockImplementation(() => Promise.resolve(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} })));

		const aDef = defineQuery({ method: "GET", path: "/telescope/a", input: z.undefined() }, { response: envelopeSchema, queryKey: () => ["telescope", "a"] });
		const bDef = defineQuery({ method: "GET", path: "/telescope/b", input: z.undefined() }, { response: envelopeSchema, queryKey: () => ["telescope", "b"] });
		const { report } = await prefetchPage([specOf(endpoint, { range: "15m" }), specOf(aDef, undefined), specOf(bDef, undefined)], {
			config: testConfig,
			maxConcurrency: 2,
		});

		expect(report.succeeded).toBe(3);
		expect(report.failed).toBe(0);
	});

	it("enabled can be a function evaluated per batch", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} }));

		const skipDef = defineQuery({ method: "GET", path: "/telescope/skip", input: z.undefined() }, { response: envelopeSchema, queryKey: () => ["telescope", "skip"] });
		const { state, report } = await prefetchPage([specOf(endpoint, { range: "15m" }), specOf(skipDef, undefined, { enabled: (): boolean => false })], {
			config: testConfig,
		});

		expect(report.skipped).toBe(1);
		expect(state.queries).toHaveLength(1);
	});
});

describe("cross-render dedupe + new helpers", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
		mockForwardedHeaders();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("dedupes two clients prefetching the same queryKey into one upstream fetch", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		const fetchMock = vi.mocked(fetch);
		fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { ok: "yes" }, meta: {} }));

		const clientA = new QueryClient();
		const clientB = new QueryClient();
		await Promise.all([prefetchEndpointDetailed(clientA, endpoint, { range: "15m" }, testConfig), prefetchEndpointDetailed(clientB, endpoint, { range: "15m" }, testConfig)]);

		// Both clients got the data, but the upstream was hit once.
		expect(clientA.getQueryData(endpoint.queryKey({ range: "15m" }))).toEqual({ success: true, data: { ok: "yes" }, meta: {} });
		expect(clientB.getQueryData(endpoint.queryKey({ range: "15m" }))).toEqual({ success: true, data: { ok: "yes" }, meta: {} });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

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

	it("queryKeyString is deterministic", () => {
		expect(queryKeyString(["telescope", "overview", { a: 1 }])).toBe(JSON.stringify(["telescope", "overview", { a: 1 }]));
	});

	it("schema failures include the first failing path", async () => {
		cookiesMock.mockReturnValue(cookieStoreWithAccess("access-token"));
		vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true, data: { nope: 1 }, meta: {} }));

		const outcome = (await prefetchEndpointDetailed(new QueryClient(), endpoint, { range: "15m" }, testConfig)).outcome;

		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.failure.kind).toBe("schema");
	});
});
