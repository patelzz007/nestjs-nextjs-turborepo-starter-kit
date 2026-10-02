import { describe, expect, it } from "vitest";

import { ApiErrorBodySchema, ApiErrorCodes, ApiErrorCodeSchema, ApiErrorResponseSchema, ApiLockoutDetailsSchema, StandardApiErrorCodeSchema } from "./api-error";

const META = { correlationId: "corr-1", timestamp: 1790812800000 };

describe("ApiErrorResponseSchema", () => {
	it("accepts the standard envelope with and without details", () => {
		expect(ApiErrorResponseSchema.safeParse({ success: false, error: { code: "NOT_FOUND", message: "Not found" }, meta: META }).success).toBe(true);
		expect(
			ApiErrorResponseSchema.safeParse({
				success: false,
				error: { code: "VALIDATION_ERROR", message: "Validation failed", details: { issues: [{ path: "email", message: "bad", code: "format" }] } },
				meta: META,
			}).success,
		).toBe(true);
	});

	it("mirrors the success envelope's meta (correlationId defaults to empty)", () => {
		const parsed = ApiErrorResponseSchema.parse({ success: false, error: { code: "INTERNAL_ERROR", message: "x" }, meta: { timestamp: 1 } });

		expect(parsed.meta.correlationId).toBe("");
	});

	it("rejects success: true, unknown keys, empty messages and non-machine codes", () => {
		expect(ApiErrorResponseSchema.safeParse({ success: true, error: { code: "X", message: "x" }, meta: META }).success).toBe(false);
		expect(ApiErrorResponseSchema.safeParse({ success: false, error: { code: "X", message: "x", stack: "at …" }, meta: META }).success).toBe(false);
		expect(ApiErrorResponseSchema.safeParse({ success: false, error: { code: "X", message: "" }, meta: META }).success).toBe(false);
		expect(ApiErrorResponseSchema.safeParse({ success: false, error: { code: "Bad Request", message: "x" }, meta: META }).success).toBe(false);
	});

	it("rejects the legacy flat Nest body", () => {
		expect(ApiErrorResponseSchema.safeParse({ statusCode: 401, message: "Unauthorized", error: "INVALID_CREDENTIALS" }).success).toBe(false);
	});
});

describe("ApiErrorCodeSchema", () => {
	it("accepts SCREAMING_SNAKE_CASE domain codes", () => {
		expect(ApiErrorCodeSchema.safeParse("ACCESS_TOKEN_EXPIRED").success).toBe(true);
		expect(ApiErrorCodeSchema.safeParse("P2002").success).toBe(true);
	});

	it("rejects prose and over-long codes", () => {
		expect(ApiErrorCodeSchema.safeParse("Not Found").success).toBe(false);
		expect(ApiErrorCodeSchema.safeParse("lower_case").success).toBe(false);
		expect(ApiErrorCodeSchema.safeParse("A".repeat(65)).success).toBe(false);
	});

	it("every standard code is itself a valid code", () => {
		for (const code of StandardApiErrorCodeSchema.options) {
			expect(ApiErrorCodeSchema.safeParse(code).success).toBe(true);
		}
		expect(ApiErrorCodes.IDEMPOTENCY_KEY_REUSED).toBe("IDEMPOTENCY_KEY_REUSED");
	});
});

describe("ApiLockoutDetailsSchema", () => {
	it("reads lockout timing out of an open details record", () => {
		expect(ApiLockoutDetailsSchema.parse({ lockedUntil: 1790812800000, remainingSeconds: 30, other: "x" })).toEqual({ lockedUntil: 1790812800000, remainingSeconds: 30 });
		expect(ApiLockoutDetailsSchema.parse({})).toEqual({});
	});
});

describe("ApiErrorBodySchema (flattened client body)", () => {
	it("keeps the legacy flat shape the client ApiError exposes", () => {
		expect(ApiErrorBodySchema.safeParse({ message: "Invalid", statusCode: 401, error: "INVALID_CREDENTIALS" }).success).toBe(true);
		expect(ApiErrorBodySchema.safeParse({ message: "locked", error: "ACCOUNT_LOCKED", lockedUntil: 1790812800000, remainingSeconds: 5 }).success).toBe(true);
		expect(ApiErrorBodySchema.safeParse({ message: "x", unexpected: true }).success).toBe(false);
	});
});
