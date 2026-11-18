import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KafkaDeadlineExceededError, withKafkaDeadline } from "../kafka-deadline";

const TIMEOUT_MS = 1_000;

describe("withKafkaDeadline", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("settles with the call when it finishes in time, and leaves no timer behind", async () => {
		await expect(withKafkaDeadline(Promise.resolve("acked"), "publish", TIMEOUT_MS)).resolves.toBe("acked");
		expect(vi.getTimerCount()).toBe(0);
	});

	it("passes the call's own failure through unchanged", async () => {
		const failure = new Error("broker refused");

		await expect(withKafkaDeadline(Promise.reject(failure), "publish", TIMEOUT_MS)).rejects.toBe(failure);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("wraps a failure that is not an Error, so every rejection carries a message and a stack", async () => {
		// A thenable that fails with a bare string — what a non-conforming library callback can hand back.
		const bareFailure = {
			then: (_onFulfilled: (value: string) => void, onRejected: (reason: string) => void): void => {
				onRejected("socket closed");
			},
		};

		await expect(withKafkaDeadline(Promise.resolve(bareFailure), "publish", TIMEOUT_MS)).rejects.toThrow(new Error("socket closed"));
	});

	it("rejects with a typed error naming the operation once the time runs out", async () => {
		const pending = withKafkaDeadline(new Promise<string>(() => undefined), "Kafka publish to platform.auth", TIMEOUT_MS);
		const assertion = expect(pending).rejects.toThrow(new KafkaDeadlineExceededError("Kafka publish to platform.auth", TIMEOUT_MS));

		vi.advanceTimersByTime(TIMEOUT_MS);

		await assertion;
		await expect(pending).rejects.toMatchObject({ operation: "Kafka publish to platform.auth", timeoutMs: TIMEOUT_MS });
	});
});
