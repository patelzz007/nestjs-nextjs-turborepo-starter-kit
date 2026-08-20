// ============================================
// lib/api-server.test.ts - SSR prefetch helper coverage
// ============================================
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
	classifyError,
	describeFailure,
	isPrefetchFailure,
	resolveConfig,
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





// ── Helpers ─────────────────────────────────────────────────────────────────



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
});
