import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { AUTH_CHECK_RATE_MAX_CHECKS, AUTH_CHECK_RATE_WINDOW_MS, AuthRateLimitService } from "./auth-rate-limit.service";

const START_EPOCH_MS = 1_790_812_800_000;

function service(maxKeys = 100): AuthRateLimitService {
	return new AuthRateLimitService(createTestTypedConfig({ SECURITY_COUNTER_MAX_KEYS: String(maxKeys) }));
}

function exhaust(limiter: AuthRateLimitService, userId: string): void {
	for (let index = 0; index < AUTH_CHECK_RATE_MAX_CHECKS; index += 1) {
		expect(limiter.isAllowed(userId)).toBe(true);
	}
}

describe("AuthRateLimitService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START_EPOCH_MS);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("allows checks up to the per-window limit and counts them down", () => {
		const limiter = service();

		expect(limiter.remaining("user-1")).toBe(AUTH_CHECK_RATE_MAX_CHECKS);
		expect(limiter.isAllowed("user-1")).toBe(true);
		expect(limiter.remaining("user-1")).toBe(AUTH_CHECK_RATE_MAX_CHECKS - 1);
	});

	it("blocks the check after the limit without recording it", () => {
		const limiter = service();
		exhaust(limiter, "user-1");

		expect(limiter.isAllowed("user-1")).toBe(false);
		expect(limiter.isAllowed("user-1")).toBe(false);
		expect(limiter.remaining("user-1")).toBe(0);
	});

	it("keeps users independent", () => {
		const limiter = service();
		exhaust(limiter, "user-1");

		expect(limiter.isAllowed("user-2")).toBe(true);
	});

	it("slides the window: checks older than the window stop counting", () => {
		const limiter = service();
		exhaust(limiter, "user-1");

		vi.advanceTimersByTime(AUTH_CHECK_RATE_WINDOW_MS - 1);
		expect(limiter.isAllowed("user-1")).toBe(false);

		vi.advanceTimersByTime(1);
		expect(limiter.isAllowed("user-1")).toBe(true);
		expect(limiter.remaining("user-1")).toBe(AUTH_CHECK_RATE_MAX_CHECKS - 1);
	});

	it("only frees the slots that aged out (edge: a check exactly one window old no longer counts)", () => {
		const limiter = service();
		expect(limiter.isAllowed("user-1")).toBe(true);
		vi.advanceTimersByTime(1000);
		for (let index = 1; index < AUTH_CHECK_RATE_MAX_CHECKS; index += 1) {
			expect(limiter.isAllowed("user-1")).toBe(true);
		}

		vi.advanceTimersByTime(AUTH_CHECK_RATE_WINDOW_MS - 1000);
		expect(limiter.remaining("user-1")).toBe(1);
		expect(limiter.isAllowed("user-1")).toBe(true);
		expect(limiter.isAllowed("user-1")).toBe(false);
	});

	it("fails closed for new users when the tracker is at capacity, but keeps serving tracked users", () => {
		const limiter = service(2);
		expect(limiter.isAllowed("user-1")).toBe(true);
		expect(limiter.isAllowed("user-2")).toBe(true);

		expect(limiter.isAllowed("user-3")).toBe(false);
		expect(limiter.isAllowed("user-1")).toBe(true);
	});

	it("releases capacity once a tracked user's window has expired", () => {
		const limiter = service(2);
		expect(limiter.isAllowed("user-1")).toBe(true);
		expect(limiter.isAllowed("user-2")).toBe(true);

		vi.advanceTimersByTime(AUTH_CHECK_RATE_WINDOW_MS + 1);

		expect(limiter.isAllowed("user-3")).toBe(true);
	});

	it("clear() forgets every window", () => {
		const limiter = service();
		exhaust(limiter, "user-1");

		limiter.clear();

		expect(limiter.isAllowed("user-1")).toBe(true);
	});
});
