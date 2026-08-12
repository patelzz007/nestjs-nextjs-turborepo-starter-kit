import { describe, expect, it } from "vitest";

import type { QueryLogEntry, RequestLogEntry } from "@workspace/shared";

import { TelescopeMemoryStore } from "./telescope.store.js";

function makeRequest(overrides: Partial<RequestLogEntry>): RequestLogEntry {
	return {
		id: "req-1",
		correlationId: "corr-1",
		method: "GET",
		path: "/api/orders",
		queryString: null,
		statusCode: 200,
		userId: null,
		durationMs: 120,
		ip: "127.0.0.1",
		userAgent: null,
		requestBody: null,
		responseBody: null,
		requestHeaders: null,
		spans: [],
		createdAt: "2026-08-12T10:00:00.000Z",
		...overrides,
	};
}

function makeQuery(overrides: Partial<QueryLogEntry>): QueryLogEntry {
	return {
		id: "query-1",
		correlationId: "corr-1",
		model: "Order",
		operation: "findMany",
		query: "SELECT * FROM orders",
		params: null,
		durationMs: 40,
		createdAt: "2026-08-12T10:00:01.000Z",
		...overrides,
	};
}

describe("TelescopeMemoryStore", () => {
	it("pushes and reads back a request by id", () => {
		const store = new TelescopeMemoryStore(100);
		const entry = makeRequest({});
		store.pushRequest(entry);
		expect(store.getRequest("req-1")?.id).toBe("req-1");
		expect(store.getRequest("missing")).toBeUndefined();
	});

	it("evicts the oldest request beyond the ring-buffer cap", () => {
		const store = new TelescopeMemoryStore(2);
		store.pushRequest(makeRequest({ id: "a", correlationId: "ca" }));
		store.pushRequest(makeRequest({ id: "b", correlationId: "cb" }));
		store.pushRequest(makeRequest({ id: "c", correlationId: "cc" }));
		expect(store.getRequest("a")).toBeUndefined();
		expect(store.getRequest("b")).toBeDefined();
		expect(store.getRequest("c")).toBeDefined();
	});

	it("lists newest-first by default with pagination totals", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({ id: "old", durationMs: 10, createdAt: "2026-08-12T10:00:00.000Z" }));
		store.pushRequest(makeRequest({ id: "new", durationMs: 900, createdAt: "2026-08-12T10:05:00.000Z" }));
		const page = store.listRequests({ page: 1, pageSize: 1, sort: "newest" });
		expect(page.total).toBe(2);
		expect(page.items.map((item) => item.id)).toEqual(["new"]);
		const second = store.listRequests({ page: 2, pageSize: 1, sort: "newest" });
		expect(second.items.map((item) => item.id)).toEqual(["old"]);
	});

	it("filters by method, status, minDurationMs and sorts by duration", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({ id: "fast", method: "GET", statusCode: 200, durationMs: 10 }));
		store.pushRequest(makeRequest({ id: "slow", method: "POST", statusCode: 500, durationMs: 842 }));
		const filtered = store.listRequests({ page: 1, pageSize: 10, sort: "duration", status: 500 });
		expect(filtered.total).toBe(1);
		expect(filtered.items[0]?.id).toBe("slow");
		const slowOnly = store.listRequests({ page: 1, pageSize: 10, sort: "newest", minDurationMs: 100 });
		expect(slowOnly.total).toBe(1);
	});

	it("joins queries and dumps by correlationId", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({}));
		store.pushQuery(makeQuery({}));
		store.pushQuery(makeQuery({ id: "query-2", correlationId: "other" }));
		store.pushDump({ id: "dump-1", name: "cart.items", value: [1, 2], correlationId: "corr-1", createdAt: "2026-08-12T10:00:02.000Z" });
		expect(store.listQueriesByCorrelationId("corr-1").map((q) => q.id)).toEqual(["query-1"]);
		expect(store.listDumpsByCorrelationId("corr-1").map((d) => d.id)).toEqual(["dump-1"]);
	});

	it("computes overview stats over the range window", () => {
		const store = new TelescopeMemoryStore(100);
		// Within the last 15 minutes:
		store.pushRequest(makeRequest({ id: "r1", durationMs: 100, statusCode: 200, createdAt: "2026-08-12T10:00:00.000Z" }));
		store.pushRequest(makeRequest({ id: "r2", durationMs: 200, statusCode: 200, createdAt: "2026-08-12T10:01:00.000Z" }));
		store.pushRequest(makeRequest({ id: "r3", durationMs: 700, statusCode: 500, createdAt: "2026-08-12T10:02:00.000Z" }));
		store.pushQuery(makeQuery({ durationMs: 900, createdAt: "2026-08-12T10:01:30.000Z" }));
		store.pushQuery(makeQuery({ id: "query-fast", durationMs: 10, createdAt: "2026-08-12T10:01:31.000Z" }));
		store.pushException({
			id: "ex-1",
			correlationId: "corr-1",
			errorGroup: "group-a",
			name: "BadRequestException",
			message: "nope",
			stack: null,
			statusCode: 400,
			path: "/api/orders",
			method: "POST",
			userId: null,
			occurrences: 1,
			createdAt: "2026-08-12T10:01:00.000Z",
		});
		store.pushException({
			id: "ex-2",
			correlationId: "corr-2",
			errorGroup: "group-a",
			name: "BadRequestException",
			message: "nope",
			stack: null,
			statusCode: 400,
			path: "/api/orders",
			method: "POST",
			userId: null,
			occurrences: 1,
			createdAt: "2026-08-12T10:01:05.000Z",
		});

		const stats = store.overviewStats("2026-08-12T09:50:00.000Z");
		expect(stats.requests).toBe(3);
		expect(stats.avgDurationMs).toBeCloseTo(333.33, 0);
		expect(stats.errorCount).toBe(1);
		expect(stats.slowest?.id).toBe("r3");
		expect(stats.sqlCount).toBe(2);
		expect(stats.slowSqlCount).toBe(1);
		expect(stats.exceptionGroups).toBe(1);
	});

	it("treats out-of-range requests as absent from the overview", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({ createdAt: "2026-08-10T10:00:00.000Z" }));
		const stats = store.overviewStats("2026-08-12T09:50:00.000Z");
		expect(stats.requests).toBe(0);
	});

	it("clears everything", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({}));
		store.clear();
		expect(store.listRequests({ page: 1, pageSize: 10, sort: "newest" }).total).toBe(0);
		expect(store.getRequest("req-1")).toBeUndefined();
	});
});
