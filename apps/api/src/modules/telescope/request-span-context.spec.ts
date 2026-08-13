import { describe, expect, it } from "vitest";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { shouldCaptureRequest } from "./should-capture.js";

function makeStore(): SpanStore {
	return {
		correlationId: "corr-1",
		startedAt: performance.now(),
		spans: [],
		captured: true,
		userId: null,
		requestBody: null,
	};
}

describe("RequestSpanContext", () => {
	it("records a span with offsets relative to request start", async () => {
		const store = makeStore();
		await RequestSpanContext.run(store, async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
			await RequestSpanContext.span("auth:verify-jwt", "guard", async () => {
				await new Promise((resolve) => setTimeout(resolve, 5));
			});
		});
		expect(store.spans).toHaveLength(1);
		expect(store.spans[0]?.name).toBe("auth:verify-jwt");
		expect(store.spans[0]?.kind).toBe("guard");
		expect(store.spans[0]?.durationMs).toBeGreaterThanOrEqual(4);
		expect(store.spans[0]?.startOffsetMs).toBeGreaterThanOrEqual(4);
	});

	it("is a zero-cost no-op outside a run scope", async () => {
		const before = performance.now();
		const result = await RequestSpanContext.span("nope", "service", async () => "value");
		expect(result).toBe("value");
		expect(performance.now() - before).toBeLessThan(1000);
	});

	it("skips recording when the request is sampled out", async () => {
		const store: SpanStore = { ...makeStore(), captured: false };
		await RequestSpanContext.run(store, async () => {
			await RequestSpanContext.span("should-not-record", "service", async () => undefined);
		});
		expect(store.spans).toHaveLength(0);
	});
});

describe("shouldCaptureRequest", () => {
	const options = { ignorePaths: ["/health", "/docs", "/telescope"], redactPaths: [], capturePaths: undefined };

	it("skips preflight OPTIONS", () => {
		expect(shouldCaptureRequest("OPTIONS", "/api/orders", options)).toBe(false);
	});

	it("skips ignore paths and their subtrees", () => {
		expect(shouldCaptureRequest("GET", "/health", options)).toBe(false);
		expect(shouldCaptureRequest("GET", "/docs/swagger-ui", options)).toBe(false);
		expect(shouldCaptureRequest("GET", "/telescope/requests", options)).toBe(false);
	});

	it("captures everything else", () => {
		expect(shouldCaptureRequest("GET", "/auth/me", options)).toBe(true);
		expect(shouldCaptureRequest("POST", "/api/orders", options)).toBe(true);
	});

	it("skips redact paths on top of the built-in ignore list", () => {
		const redacted = { ...options, redactPaths: ["/auth/login", "/admin/pii"] };
		expect(shouldCaptureRequest("POST", "/auth/login", redacted)).toBe(false);
		expect(shouldCaptureRequest("GET", "/admin/pii/records", redacted)).toBe(false);
		expect(shouldCaptureRequest("GET", "/auth/me", redacted)).toBe(true);
	});

	it("capturePaths allowlist captures ONLY listed prefixes", () => {
		const allowlisted = { ignorePaths: ["/health"], redactPaths: [], capturePaths: ["/api"] };
		expect(shouldCaptureRequest("GET", "/api/orders", allowlisted)).toBe(true);
		expect(shouldCaptureRequest("GET", "/api", allowlisted)).toBe(true);
		expect(shouldCaptureRequest("GET", "/auth/me", allowlisted)).toBe(false);
		expect(shouldCaptureRequest("GET", "/health", allowlisted)).toBe(false);
	});

	it("an empty capturePaths list is treated as no allowlist", () => {
		expect(shouldCaptureRequest("GET", "/auth/me", { ...options, capturePaths: [] })).toBe(true);
	});
});
