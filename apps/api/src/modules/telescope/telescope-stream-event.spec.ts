import { describe, expect, it } from "vitest";

import {
	TelescopeExceptionStreamEventSchema,
	TelescopeJobStreamEventSchema,
	TelescopeRequestStreamEventSchema,
	TelescopeScheduleStreamEventSchema,
	TelescopeStreamEventSchema,
} from "@workspace/shared";

/**
 * The stream schema is a strict discriminated union: each frame type carries
 * exactly its own fields (`.strict()` rejects extras). These tests lock that
 * contract so a `job` frame can never smuggle request-only fields (or vice
 * versa), and the admin live feed can trust its type-narrowed rows.
 */
describe("TelescopeStreamEventSchema", () => {
	const requestFrame: Readonly<Record<string, string | number | null>> = {
		type: "request",
		id: "req-1",
		method: "GET",
		path: "/health",
		statusCode: 200,
		durationMs: 12,
	};
	const exceptionFrame: Readonly<Record<string, string | number>> = {
		type: "exception",
		id: "exc-1",
		name: "BadRequestException",
		message: "Bad input",
		statusCode: 400,
	};
	const jobFrame: Readonly<Record<string, string | number>> = {
		type: "job",
		id: "job-1",
		jobName: "send-email:welcome",
		jobStatus: "succeeded",
		durationMs: 573,
	};
	const scheduleFrame: Readonly<Record<string, string | number>> = {
		type: "schedule",
		id: "telescope-demo",
		scheduleName: "telescope-demo",
		scheduleStatus: "succeeded",
		durationMs: 42,
	};

	it("parses every frame type", () => {
		const frames: readonly Readonly<Record<string, string | number | null>>[] = [requestFrame, exceptionFrame, jobFrame, scheduleFrame];
		for (const frame of frames) {
			expect(TelescopeStreamEventSchema.safeParse(frame).success).toBe(true);
		}
	});

	it("rejects a job frame that smuggles request-only fields", () => {
		const parsed = TelescopeStreamEventSchema.safeParse({ ...jobFrame, method: "GET", path: "/api/orders" });
		expect(parsed.success).toBe(false);
		expect(TelescopeJobStreamEventSchema.safeParse({ ...jobFrame, method: "GET" }).success).toBe(false);
	});

	it("rejects a request frame carrying job fields", () => {
		const parsed = TelescopeStreamEventSchema.safeParse({ ...requestFrame, jobName: "send-email:welcome" });
		expect(parsed.success).toBe(false);
		expect(TelescopeRequestStreamEventSchema.safeParse({ ...requestFrame, jobName: "send-email:welcome" }).success).toBe(false);
	});

	it("rejects frames missing required fields", () => {
		expect(TelescopeStreamEventSchema.safeParse({ type: "request", id: "req-1", path: "/health", statusCode: 200, durationMs: 12 }).success).toBe(false);
		expect(TelescopeExceptionStreamEventSchema.safeParse({ type: "exception", id: "exc-1", name: "Oops", statusCode: 500 }).success).toBe(false);
		expect(TelescopeScheduleStreamEventSchema.safeParse({ type: "schedule", id: "demo", scheduleStatus: "succeeded" }).success).toBe(false);
	});

	it("rejects unknown frame types", () => {
		expect(TelescopeStreamEventSchema.safeParse({ type: "mail", id: "m-1" }).success).toBe(false);
	});

	it("allows null statusCode only on request frames", () => {
		expect(TelescopeStreamEventSchema.safeParse({ ...requestFrame, statusCode: null }).success).toBe(true);
		expect(TelescopeStreamEventSchema.safeParse({ ...exceptionFrame, statusCode: null }).success).toBe(false);
	});

	// Load-bearing: the publishers emit `durationMs ?? undefined`, so a frame
	// without durationMs MUST parse — if this ever regresses to required, every
	// real job/schedule frame gets rejected at runtime by the strict union.
	it("allows job/schedule frames without durationMs", () => {
		expect(TelescopeJobStreamEventSchema.safeParse({ type: "job", id: "job-1", jobName: "sync", jobStatus: "running" }).success).toBe(true);
		expect(
			TelescopeScheduleStreamEventSchema.safeParse({ type: "schedule", id: "demo", scheduleName: "demo", scheduleStatus: "pending" }).success,
		).toBe(true);
	});

	// The runner publishes `correlationId: entry.correlationId` (string | null)
	// so the feed can navigate to the correlated request — both shapes parse.
	it("parses job frames with or without a correlation id", () => {
		expect(
			TelescopeJobStreamEventSchema.safeParse({
				type: "job",
				id: "job-1",
				jobName: "sync",
				jobStatus: "succeeded",
				correlationId: "corr-abc",
			}).success,
		).toBe(true);
		expect(
			TelescopeJobStreamEventSchema.safeParse({ type: "job", id: "job-1", jobName: "sync", jobStatus: "succeeded", correlationId: null }).success,
		).toBe(true);
	});
});
