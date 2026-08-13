import { describe, expect, it } from "vitest";

import type { RequestLogEntry, TelescopeAnnotation, TelescopeJobLogEntry, TelescopeScheduleLog, TelescopeTrendPoint } from "@workspace/shared";

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
		environment: null,
		starred: false,
		createdAt: "2026-08-12T10:00:00.000Z",
		...overrides,
	};
}

function makeJob(overrides: Partial<TelescopeJobLogEntry>): TelescopeJobLogEntry {
	return {
		id: "job-1",
		jobName: "sync-orders",
		status: "succeeded",
		durationMs: 250,
		payloadSize: 0,
		error: null,
		correlationId: null,
		enqueuedAt: "2026-08-12T10:00:00.000Z",
		startedAt: "2026-08-12T10:00:00.100Z",
		finishedAt: "2026-08-12T10:00:00.350Z",
		...overrides,
	};
}

describe("TelescopeMemoryStore — feature store surfaces", () => {
	it("stores and lists jobs, filtering by status", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushJob(makeJob({ id: "a", status: "succeeded" }));
		store.pushJob(makeJob({ id: "b", status: "failed", error: "boom" }));
		const all = store.listJobs({ page: 1, pageSize: 20 });
		expect(all.total).toBe(2);
		const failed = store.listJobs({ page: 1, pageSize: 20, status: "failed" });
		expect(failed.items.length).toBe(1);
		expect(failed.items[0]?.id).toBe("b");
		expect(store.getJob("a")?.jobName).toBe("sync-orders");
		expect(store.getJob("missing")).toBeUndefined();
	});

	it("upserts schedules (same name replaces the previous entry)", () => {
		const store = new TelescopeMemoryStore(100);
		const schedule: TelescopeScheduleLog = {
			name: "nightly-report",
			cron: "0 3 * * *",
			status: "succeeded",
			lastRunAt: "2026-08-12T03:00:00.000Z",
			lastDurationMs: 400,
			lastError: null,
			nextRunAt: "2026-08-13T03:00:00.000Z",
		};
		store.upsertSchedule(schedule);
		store.upsertSchedule({ ...schedule, status: "failed", lastError: "disk full" });
		expect(store.listSchedules().length).toBe(1);
		expect(store.listSchedules()[0]?.status).toBe("failed");
	});

	it("round-trips annotations, including clearing to null", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(makeRequest({}));
		const annotation: TelescopeAnnotation = { starred: true, comment: "investigating", updatedAt: "2026-08-12T10:05:00.000Z" };
		store.setAnnotation("req-1", annotation);
		expect(store.getAnnotation("req-1")).toEqual(annotation);
		store.setAnnotation("req-1", null);
		expect(store.getAnnotation("req-1")).toBeNull();
		expect(store.getAnnotation("missing")).toBeNull();
	});

	it("lists logs correlated back to a request, with level + text filters", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushRequest(
			makeRequest({
				id: "req-1",
				path: "/api/orders",
				method: "GET",
				logs: [
					{ level: "error", message: "connection refused", timestamp: "2026-08-12T10:00:01.000Z" },
					{ level: "info", message: "loaded 3 orders", timestamp: "2026-08-12T10:00:02.000Z" },
				],
			}),
		);
		const all = store.listLogs({ page: 1, pageSize: 20 });
		expect(all.total).toBe(2);
		expect(all.items[0]?.requestId).toBe("req-1");
		expect(all.items[0]?.path).toBe("/api/orders");
		const errors = store.listLogs({ page: 1, pageSize: 20, level: "error" });
		expect(errors.items.length).toBe(1);
		const search = store.listLogs({ page: 1, pageSize: 20, q: "refused" });
		expect(search.items.length).toBe(1);
	});

	it("builds a leaderboard grouped by route over a window", () => {
		const store = new TelescopeMemoryStore(100);
		const base = "2026-08-12T10:00:00.000Z";
		store.pushRequest(makeRequest({ id: "a", path: "/api/orders", durationMs: 100, createdAt: base }));
		store.pushRequest(makeRequest({ id: "b", path: "/api/orders", durationMs: 900, createdAt: base }));
		store.pushRequest(makeRequest({ id: "c", path: "/api/users", durationMs: 500, createdAt: base, statusCode: 500 }));
		const entries = store.leaderboard("2026-08-12T09:00:00.000Z", 10);
		expect(entries.length).toBe(2);
		const orders = entries.find((entry) => entry.path === "/api/orders");
		expect(orders?.count).toBe(2);
		expect(orders?.maxMs).toBe(900);
		const users = entries.find((entry) => entry.path === "/api/users");
		expect(users?.errorCount).toBe(1);
	});

	it("buckets trends over a window, counting requests and errors", () => {
		const store = new TelescopeMemoryStore(100);
		const base = "2026-08-12T10:00:00.000Z";
		store.pushRequest(makeRequest({ id: "a", createdAt: base }));
		store.pushRequest(makeRequest({ id: "b", createdAt: base, statusCode: 500 }));
		const points = store.trends("2026-08-12T09:00:00.000Z", 24);
		expect(points.length).toBe(24);
		// `Date.now()` drives the bucket boundaries, so assert on totals across
		// all buckets (the request lands in whatever the current bucket is).
		const totalRequests = points.reduce((sum: number, point: TelescopeTrendPoint): number => sum + point.requests, 0);
		const totalErrors = points.reduce((sum: number, point: TelescopeTrendPoint): number => sum + point.errors, 0);
		expect(totalRequests).toBe(2);
		expect(totalErrors).toBe(1);
	});

	it("stores and lists alerts", () => {
		const store = new TelescopeMemoryStore(100);
		store.pushAlert({
			id: "alert-1",
			requestId: "req-1",
			method: "GET",
			path: "/api/orders",
			statusCode: 500,
			durationMs: 10,
			reason: "error",
			firedAt: "2026-08-12T10:00:00.000Z",
		});
		const alerts = store.listAlerts(50);
		expect(alerts.length).toBe(1);
		expect(alerts[0]?.reason).toBe("error");
	});
});
