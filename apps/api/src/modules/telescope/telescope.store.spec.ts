import { describe, expect, it } from "vitest";

import type { ExceptionLogEntry, QueryLogEntry, RequestLogEntry, TelescopeWebhookDelivery } from "@workspace/shared";

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
		logs: [],
		handlerParams: null,
		cacheOps: [],
		piiFlags: [],
		starred: false,
		n1WarningCount: 0,
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

	// ── Improvement v2: traffic time-series + status counts ────────────

	it("buckets the traffic time-series across 24 points and counts status classes", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({ id: "r1", durationMs: 100, statusCode: 200, createdAt: "2026-08-12T10:00:00.000Z" }));
		store.pushRequest(makeRequest({ id: "r2", durationMs: 200, statusCode: 302, createdAt: "2026-08-12T10:01:00.000Z" }));
		store.pushRequest(makeRequest({ id: "r3", durationMs: 700, statusCode: 500, createdAt: "2026-08-12T10:02:00.000Z" }));
		store.pushRequest(makeRequest({ id: "r4", durationMs: 50, statusCode: 404, createdAt: "2026-08-12T10:03:00.000Z" }));
		store.pushRequest(makeRequest({ id: "r5", durationMs: 10, statusCode: null, createdAt: "2026-08-12T10:04:00.000Z" }));

		const stats = store.overviewStats("2026-08-12T09:50:00.000Z");

		// Fixed 24 buckets; every request lands somewhere in range (sums must
		// match the raw counts), and all bucket counts are non-negative.
		expect(stats.traffic).toHaveLength(24);
		expect(stats.traffic.reduce((sum: number, point): number => sum + point.requests, 0)).toBe(5);
		// Two errors: r3 (500) and r5 (null status — counts as 500 in the same
		// `(statusCode ?? 500) >= 500` semantics as the overview's errorCount).
		expect(stats.traffic.reduce((sum: number, point): number => sum + point.errors, 0)).toBe(2);
		expect(stats.traffic.every((point): boolean => point.requests >= 0 && point.errors >= 0)).toBe(true);

		// Status classes: 200 → 2xx, 302 → 3xx, 404 → 4xx, 500 → 5xx, null → other.
		expect(stats.statusCounts).toEqual({ "2xx": 1, "3xx": 1, "4xx": 1, "5xx": 1, other: 1 });
	});

	it("treats out-of-range requests as absent from the overview", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({ createdAt: "2026-08-10T10:00:00.000Z" }));
		const stats = store.overviewStats("2026-08-12T09:50:00.000Z");
		expect(stats.requests).toBe(0);
		expect(stats.traffic).toHaveLength(24);
		expect(stats.traffic.every((point): boolean => point.requests === 0)).toBe(true);
	});

	it("clears everything", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({}));
		store.clear();
		expect(store.listRequests({ page: 1, pageSize: 10, sort: "newest" }).total).toBe(0);
		expect(store.getRequest("req-1")).toBeUndefined();
	});

	// ── Improvement 3: smarter eviction ──────────────────────────────

	it("evicts fast healthy requests before slow or errored ones", () => {
		const store = new TelescopeMemoryStore(3);
		// Two protected entries at the back: a slow one (1.2s) and a 500.
		store.pushRequest(makeRequest({ id: "slow", correlationId: "cs", durationMs: 1200, statusCode: 200 }));
		store.pushRequest(makeRequest({ id: "err", correlationId: "ce", durationMs: 50, statusCode: 500 }));
		store.pushRequest(makeRequest({ id: "fast", correlationId: "cf", durationMs: 20, statusCode: 200 }));
		store.pushRequest(makeRequest({ id: "newest", correlationId: "cn", durationMs: 10, statusCode: 200 }));

		// Only ONE slot was freed — the buffer prefers evicting the fast/healthy
		// "fast" row over the protected "slow"/"err" rows.
		expect(store.getRequest("fast")).toBeUndefined();
		expect(store.getRequest("slow")).toBeDefined();
		expect(store.getRequest("err")).toBeDefined();
		expect(store.getRequest("newest")).toBeDefined();
	});

	it("still evicts the oldest when the whole buffer is protected", () => {
		const store = new TelescopeMemoryStore(2);
		store.pushRequest(makeRequest({ id: "a", correlationId: "ca", durationMs: 2000, statusCode: 200 }));
		store.pushRequest(makeRequest({ id: "b", correlationId: "cb", durationMs: 2000, statusCode: 200 }));
		store.pushRequest(makeRequest({ id: "c", correlationId: "cc", durationMs: 2000, statusCode: 200 }));
		expect(store.getRequest("a")).toBeUndefined();
		expect(store.getRequest("b")).toBeDefined();
		expect(store.getRequest("c")).toBeDefined();
	});

	// ── Improvement 15: exception group aggregation ──────────────────

	it("aggregates repeats of the same errorGroup into one entry", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushException(makeException({ id: "e1", errorGroup: "g1", createdAt: "2026-08-12T10:00:00.000Z" }));
		store.pushException(makeException({ id: "e2", errorGroup: "g1", createdAt: "2026-08-12T10:01:00.000Z" }));
		store.pushException(makeException({ id: "e3", errorGroup: "g2", createdAt: "2026-08-12T10:02:00.000Z" }));

		const list = store.listExceptions({ page: 1, pageSize: 10 });
		expect(list.total).toBe(2);

		const groupOne = list.items.find((entry) => entry.errorGroup === "g1");
		expect(groupOne?.occurrences).toBe(2);
		expect(groupOne?.id).toBe("e1"); // first id wins
		expect(groupOne?.firstSeenAt).toBe("2026-08-12T10:00:00.000Z");
		expect(groupOne?.lastSeenAt).toBe("2026-08-12T10:01:00.000Z");
	});

	// ── Improvement 4: retention pruning ─────────────────────────────

	it("prunes entries older than the retention window", () => {
		// Fixture timestamps are relative to the real clock so the test is not
		// flaky (the window is computed against Date.now()).
		const now: number = Date.now();
		const twoHoursAgo: string = new Date(now - 2 * 60 * 60 * 1000).toISOString();
		const tenMinutesAgo: string = new Date(now - 10 * 60 * 1000).toISOString();

		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({ id: "old", correlationId: "co", createdAt: twoHoursAgo }));
		store.pushRequest(makeRequest({ id: "fresh", correlationId: "cf2", createdAt: tenMinutesAgo }));
		store.pushQuery(makeQuery({ id: "q-old", createdAt: twoHoursAgo }));

		const removed = store.pruneRetention(60); // keep the last 60 minutes
		expect(removed).toBe(2);
		expect(store.getRequest("old")).toBeUndefined();
		expect(store.getRequest("fresh")).toBeDefined();
		expect(store.listQueries({ page: 1, pageSize: 10, sort: "newest" }).total).toBe(0);
	});

	// ── Feature batch (20 new features) regressions ──────────────────────────

	describe("feature batch: search, users, starred, deliveries", () => {
		it("searches across requests, SQL, exceptions and logs (feature 1)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", path: "/api/orders", requestBody: { email: "a@b.co" } }));
			store.pushQuery(makeQuery({ id: "q1", query: "SELECT * FROM orders" }));
			store.pushException(makeException({ id: "e1", errorGroup: "g1", message: "orders boom" }));

			const found = store.search({ q: "orders", limit: 10 });
			expect(found.requests.map((entry) => entry.id)).toContain("r1");
			expect(found.sql.map((entry) => entry.id)).toContain("q1");
			expect(found.exceptions.map((entry) => entry.id)).toContain("e1");

			const bodyHit = store.search({ q: "a@b.co", limit: 10 });
			expect(bodyHit.requests.map((entry) => entry.id)).toContain("r1");

			const miss = store.search({ q: "zzz-nope", limit: 10 });
			expect(miss.requests).toHaveLength(0);
		});

		it("returns an empty result set for blank queries (no 500)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", path: "/api/orders" }));

			const blank = store.search({ q: "", limit: 10 });
			expect(blank.requests).toHaveLength(0);
			expect(blank.sql).toHaveLength(0);

			const whitespace = store.search({ q: "   ", limit: 10 });
			expect(whitespace.requests).toHaveLength(0);
		});

		it("filters requests by free-text q over path/query/body (feature 2)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", path: "/api/orders", queryString: "status=open" }));
			store.pushRequest(makeRequest({ id: "r2", path: "/api/users" }));

			const hit = store.listRequests({ page: 1, pageSize: 10, q: "orders" });
			expect(hit.items.map((entry) => entry.id)).toEqual(["r1"]);

			const queryHit = store.listRequests({ page: 1, pageSize: 10, q: "status=open" });
			expect(queryHit.items.map((entry) => entry.id)).toEqual(["r1"]);
		});

		it("q filter matches the user id so pasting a UUID finds that user's traffic (feature 3)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", path: "/api/orders", userId: "uuid-1234" }));
			store.pushRequest(makeRequest({ id: "r2", path: "/api/users", userId: "uuid-9999" }));

			const userHit = store.listRequests({ page: 1, pageSize: 10, q: "uuid-9999" });
			expect(userHit.items.map((entry) => entry.id)).toEqual(["r2"]);

			const miss = store.listRequests({ page: 1, pageSize: 10, q: "uuid-0000" });
			expect(miss.items).toHaveLength(0);
		});

		it("global search matches the user id (feature 1)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", path: "/api/orders", userId: "uuid-1234" }));
			store.pushRequest(makeRequest({ id: "r2", path: "/api/users", userId: "uuid-9999" }));

			const hit = store.search({ q: "uuid-1234", limit: 10 });
			expect(hit.requests.map((entry) => entry.id)).toEqual(["r1"]);

			const miss = store.search({ q: "uuid-0000", limit: 10 });
			expect(miss.requests).toHaveLength(0);
		});

		it("global search ORs in requests whose resolved email matches (feature 1)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", path: "/api/orders", userId: "uuid-1234" }));
			store.pushRequest(makeRequest({ id: "r2", path: "/api/users", userId: null }));

			// `emailUserIds` is the set the service resolves from the users table;
			// the needle itself does not match r1's path/body/userId text.
			const hit = store.search({ q: "alice@example.com", limit: 10 }, new Set(["uuid-1234"]));
			expect(hit.requests.map((entry) => entry.id)).toEqual(["r1"]);

			// A user id that resolves to nothing is not matched by the email pass.
			const miss = store.search({ q: "bob@example.com", limit: 10 }, new Set(["uuid-9999"]));
			expect(miss.requests).toHaveLength(0);
		});

		it("aggregates per-user activity (feature 3)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1", userId: "u1", durationMs: 100, statusCode: 500, createdAt: "2026-08-13T10:00:00.000Z" }));
			store.pushRequest(makeRequest({ id: "r2", userId: "u1", durationMs: 300, statusCode: 200, createdAt: "2026-08-13T10:01:00.000Z" }));
			store.pushRequest(makeRequest({ id: "r3", userId: "u2", durationMs: 50, statusCode: 200, createdAt: "2026-08-13T10:02:00.000Z" }));
			store.pushRequest(makeRequest({ id: "r4", userId: null, durationMs: 10, createdAt: "2026-08-13T10:03:00.000Z" }));

			const result = store.listUsers({ page: 1, pageSize: 10, range: "24h", sort: "count" });
			const u1 = result.items.find((entry) => entry.userId === "u1");
			expect(u1?.count).toBe(2);
			expect(u1?.errorCount).toBe(1);
			expect(u1?.errorRatePct).toBe(50);
			expect(result.items.find((entry) => entry.userId === "u2")?.count).toBe(1);
			// Anonymous requests are skipped.
			expect(result.items.some((entry) => entry.userId === null)).toBe(false);
			// Email starts null (the service resolves it via the users table).
			expect(u1?.email).toBeNull();
		});

		it("filters starred requests only (feature 4)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushRequest(makeRequest({ id: "r1" }));
			store.pushRequest(makeRequest({ id: "r2" }));
			store.setAnnotation("r1", { starred: true, comment: "", updatedAt: "2026-08-13T10:00:00.000Z" });

			const starred = store.listRequests({ page: 1, pageSize: 10, starred: "true" });
			expect(starred.items.map((entry) => entry.id)).toEqual(["r1"]);

			const unstarred = store.listRequests({ page: 1, pageSize: 10, starred: "false" });
			expect(unstarred.items.map((entry) => entry.id)).toEqual(["r2"]);

			const all = store.listRequests({ page: 1, pageSize: 10 });
			expect(all.total).toBe(2);
		});

		it("records and lists webhook deliveries (feature 13)", () => {
			const store = new TelescopeMemoryStore(100);
			const delivery: TelescopeWebhookDelivery = {
				id: "d1",
				alertId: "a1",
				status: "success",
				statusCode: 200,
				durationMs: 42,
				attempt: 0,
				error: null,
				createdAt: "2026-08-13T10:00:00.000Z",
			};
			store.pushWebhookDelivery(delivery);
			expect(store.listWebhookDeliveries(10).map((entry) => entry.id)).toEqual(["d1"]);
		});

		it("includes errorRatePct in the leaderboard (feature 15)", () => {
			const store = new TelescopeMemoryStore(100);
			const now: string = new Date().toISOString();
			store.pushRequest(makeRequest({ id: "r1", method: "GET", path: "/api/x", durationMs: 100, statusCode: 500, createdAt: now }));
			store.pushRequest(makeRequest({ id: "r2", method: "GET", path: "/api/x", durationMs: 100, statusCode: 200, createdAt: now }));

			const fromIso: string = new Date(Date.now() - 60 * 60 * 1000).toISOString();
			const entries = store.leaderboard(fromIso, 10);
			expect(entries[0]?.errorRatePct).toBe(50);
		});

		it("filters jobs by name substring (feature 11)", () => {
			const store = new TelescopeMemoryStore(100);
			store.pushJob({
				id: "j1",
				jobName: "send-email:verification",
				status: "succeeded",
				durationMs: 12,
				payloadSize: 0,
				error: null,
				correlationId: null,
				enqueuedAt: "2026-08-13T10:00:00.000Z",
				startedAt: null,
				finishedAt: null,
			});
			store.pushJob({
				id: "j2",
				jobName: "demo-job",
				status: "succeeded",
				durationMs: 12,
				payloadSize: 0,
				error: null,
				correlationId: null,
				enqueuedAt: "2026-08-13T10:01:00.000Z",
				startedAt: null,
				finishedAt: null,
			});

			const hit = store.listJobs({ page: 1, pageSize: 10, jobName: "send-email" });
			expect(hit.items.map((entry) => entry.id)).toEqual(["j1"]);
		});
	});
});

/** Minimal exception fixture for the grouping/retention tests. */
function makeException(overrides: Partial<ExceptionLogEntry>): ExceptionLogEntry {
	return {
		id: "e1",
		correlationId: "corr-1",
		errorGroup: "g1",
		name: "Error",
		message: "boom",
		stack: null,
		statusCode: 500,
		path: "/api/x",
		method: "GET",
		userId: null,
		occurrences: 1,
		createdAt: "2026-08-12T10:00:00.000Z",
		firstSeenAt: "2026-08-12T10:00:00.000Z",
		lastSeenAt: "2026-08-12T10:00:00.000Z",
		...overrides,
	};
}
