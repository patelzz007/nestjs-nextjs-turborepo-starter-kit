import { describe, expect, it } from "vitest";

import { TelescopeOptionsSchema, type RequestLogEntry, type TelescopeJobLogEntry, type TelescopeOptions } from "@workspace/shared";

import { TelescopeAlertService } from "./telescope-alert.service.js";
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

function makeService(overrides: Partial<TelescopeOptions>): { readonly service: TelescopeAlertService; readonly store: TelescopeMemoryStore } {
	const store = new TelescopeMemoryStore(100);
	const options: TelescopeOptions = TelescopeOptionsSchema.parse({ alertWebhookUrl: "https://example.test/hook", sampling: { dev: 1, prod: 0.01 }, ...overrides });
	const service = new TelescopeAlertService(options, store);
	return { service, store };
}

function makeJob(overrides: Partial<TelescopeJobLogEntry>): TelescopeJobLogEntry {
	return {
		id: "job-1",
		jobName: "auth:login",
		status: "failed",
		durationMs: 42,
		payloadSize: 0,
		error: null,
		correlationId: null,
		enqueuedAt: "2026-08-12T10:00:00.000Z",
		startedAt: "2026-08-12T10:00:00.000Z",
		finishedAt: "2026-08-12T10:00:00.042Z",
		...overrides,
	};
}

describe("TelescopeAlertService", () => {
	it("fires an error alert for a 5xx response", () => {
		const { service, store } = makeService({});
		service.evaluate(makeRequest({ id: "a", statusCode: 500 }));
		const alerts = store.listAlerts(50);
		expect(alerts.length).toBe(1);
		expect(alerts[0]?.reason).toBe("error");
		expect(alerts[0]?.requestId).toBe("a");
	});

	it("fires a duration alert past the threshold", () => {
		const { service, store } = makeService({});
		service.evaluate(makeRequest({ id: "a", durationMs: 2500 }));
		const alerts = store.listAlerts(50);
		expect(alerts.length).toBe(1);
		expect(alerts[0]?.reason).toBe("duration");
	});

	it("does not alert for healthy requests", () => {
		const { service, store } = makeService({});
		service.evaluate(makeRequest({ id: "a", statusCode: 200, durationMs: 50 }));
		expect(store.listAlerts(50).length).toBe(0);
	});

	it("stores alerts even when no webhook URL is configured (webhook is the opt-in part)", () => {
		const store = new TelescopeMemoryStore(100);
		const service = new TelescopeAlertService(TelescopeOptionsSchema.parse({ sampling: { dev: 1, prod: 0.01 } }), store);
		service.evaluate(makeRequest({ id: "a", statusCode: 500 }));
		expect(store.listAlerts(50).length).toBe(1);
	});

	it("reports the reason without storing (triage helper)", () => {
		const { service, store } = makeService({});
		expect(service.reasonFor(makeRequest({ id: "a", statusCode: 503 }))).toBe("error");
		expect(service.reasonFor(makeRequest({ id: "b", durationMs: 3000 }))).toBe("duration");
		expect(service.reasonFor(makeRequest({ id: "c", statusCode: 200, durationMs: 10 }))).toBeNull();
		expect(store.listAlerts(50).length).toBe(0);
	});

	// ── Failed jobs → job alerts ────────────────────────────────────────

	it("fires a job alert for a failed job with the job name", () => {
		const { service, store } = makeService({});
		service.evaluateJob(makeJob({ id: "j1", jobName: "auth:login", error: "INVALID_CREDENTIALS" }));
		const alerts = store.listAlerts(50);
		expect(alerts.length).toBe(1);
		expect(alerts[0]?.reason).toBe("job");
		expect(alerts[0]?.jobName).toBe("auth:login");
		expect(alerts[0]?.path).toBe("auth:login");
		expect(alerts[0]?.requestId).toBeNull();
	});

	it("links a job alert to its correlated request when one exists", () => {
		const { service, store } = makeService({});
		service.evaluateJob(makeJob({ id: "j1", jobName: "send-email:welcome", correlationId: "corr-x" }));
		const alerts = store.listAlerts(50);
		expect(alerts[0]?.requestId).toBe("corr-x");
	});

	it("ignores succeeded jobs", () => {
		const { service, store } = makeService({});
		service.evaluateJob(makeJob({ id: "j1", status: "succeeded" }));
		expect(store.listAlerts(50).length).toBe(0);
	});

	it("dedupes repeated failures of the same job within the window", () => {
		const { service, store } = makeService({});
		service.evaluateJob(makeJob({ id: "j1", jobName: "auth:login" }));
		service.evaluateJob(makeJob({ id: "j2", jobName: "auth:login" }));
		expect(store.listAlerts(50).length).toBe(1);
	});
});
