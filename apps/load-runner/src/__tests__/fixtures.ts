// Test data for the runner: one queued job and k6 measurement lines.

import { LoadTestJobSchema, type LoadTestJob } from "@workspace/shared";

export function loadTestJob(overrides: Partial<LoadTestJob> = {}): LoadTestJob {
	return LoadTestJobSchema.parse({
		runId: "6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b",
		baseUrl: "http://localhost:8080/",
		target: "SCENARIO",
		scenario: "browse-marketplace",
		endpoint: null,
		mixWeights: null,
		shape: "CONSTANT",
		virtualUsers: 5,
		requestsPerSecond: 10,
		durationSeconds: 30,
		tenantSlug: "load-test",
		customers: [{ email: "lt-customer-1@load-test.invalid", password: "x", phone: "+60120000001" }],
		staff: [],
		abortKey: "ops:load-test:stop:1",
		origins: { web: "http://localhost:3000", merchant: "http://localhost:3003" },
		apiPrefix: "/api/v1",
		trafficKey: "key",
		...overrides,
	});
}

/** One k6 JSON measurement line. */
export function k6Line(metric: string, isoTime: string, value: number, step = "list rewards"): string {
	return JSON.stringify({ type: "Point", metric, data: { time: isoTime, value, tags: { step } } });
}
