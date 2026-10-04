import { afterEach, describe, expect, it, vi } from "vitest";

import { prefetch, prefetchResultFromFailure, resolvePrefetchedData, resolvePrefetchedQuery, type PrefetchFailureLogger } from "@/lib/server/prefetch";

const redirectMock = vi.hoisted(() =>
	vi.fn((path: string): void => {
		throw new Error(`NEXT_REDIRECT ${path}`);
	}),
);
const notFoundMock = vi.hoisted(() =>
	vi.fn((): void => {
		throw new Error("NEXT_NOT_FOUND");
	}),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

const SITE = { page: "/users/[id]", resource: "user detail" };

describe("prefetchResultFromFailure", () => {
	it("treats a missing cookie and a 401 as a dead session", () => {
		expect(prefetchResultFromFailure({ kind: "no-cookie" })).toEqual({ status: "unauthenticated" });
		expect(prefetchResultFromFailure({ kind: "http", status: 401 })).toEqual({ status: "unauthenticated" });
	});

	it("distinguishes forbidden and not found", () => {
		expect(prefetchResultFromFailure({ kind: "http", status: 403 })).toEqual({ status: "forbidden" });
		expect(prefetchResultFromFailure({ kind: "http", status: 404 })).toEqual({ status: "not-found" });
	});

	it("keeps 5xx, network, timeout and schema failures as failed", () => {
		expect(prefetchResultFromFailure({ kind: "http", status: 503 })).toEqual({ status: "failed", failure: { kind: "http", status: 503 } });
		expect(prefetchResultFromFailure({ kind: "timeout" })).toEqual({ status: "failed", failure: { kind: "timeout" } });
		expect(prefetchResultFromFailure({ kind: "schema", message: "id: Required" }).status).toBe("failed");
	});
});

describe("prefetch", () => {
	it("returns the data when the call succeeds and logs nothing", async () => {
		const log = vi.fn<PrefetchFailureLogger>();
		await expect(prefetch(SITE, () => Promise.resolve({ id: "u1" }), log)).resolves.toEqual({ status: "ok", data: { id: "u1" } });
		expect(log).not.toHaveBeenCalled();
	});

	it("logs a failure as an error naming the page and the resource instead of swallowing it", async () => {
		const log = vi.fn<PrefetchFailureLogger>();
		const result = await prefetch(SITE, () => Promise.reject(new Error("ECONNREFUSED")), log);
		expect(result).toEqual({ status: "failed", failure: { kind: "unreachable", cause: "ECONNREFUSED" } });
		expect(log).toHaveBeenCalledWith("error", "[admin] prefetch of user detail for /users/[id] failed (network (ECONNREFUSED))");
	});
});

describe("resolvePrefetchedData", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns the data on success", () => {
		expect(resolvePrefetchedData({ status: "ok", data: 42 })).toBe(42);
	});

	it("redirects a dead session to the login page", () => {
		expect(() => resolvePrefetchedData({ status: "unauthenticated" })).toThrow("NEXT_REDIRECT /auth/login");
	});

	it("renders the 404 page for a missing resource", () => {
		expect(() => resolvePrefetchedData({ status: "not-found" })).toThrow("NEXT_NOT_FOUND");
	});

	it("hands forbidden and failed prefetches to the client query", () => {
		expect(resolvePrefetchedData({ status: "forbidden" })).toBeUndefined();
		expect(resolvePrefetchedData({ status: "failed", failure: { kind: "timeout" } })).toBeUndefined();
	});
});

describe("resolvePrefetchedQuery", () => {
	it("binds the data to the URL state it was fetched for", () => {
		expect(resolvePrefetchedQuery("page=2", { status: "ok", data: ["row"] })).toEqual({ stateKey: "page=2", data: ["row"] });
	});

	it("leaves a failed page to the client", () => {
		expect(resolvePrefetchedQuery("page=2", { status: "failed", failure: { kind: "http", status: 500 } })).toBeUndefined();
	});
});
