import { describe, expect, it } from "vitest";

import { DEFAULT_KAFKA_CONNECT_BACKOFF, KafkaConnectBackoffPolicySchema, kafkaConnectRetryDelayMs } from "./kafka-connect-backoff";

const NO_JITTER = (): number => 0.5;
const LOWEST = (): number => 0;
const HIGHEST = (): number => 0.999_999;

describe("kafkaConnectRetryDelayMs", () => {
	it("grows exponentially from the initial delay", () => {
		const delays = [1, 2, 3, 4].map((attempt: number): number => kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, attempt, NO_JITTER));

		expect(delays).toEqual([1_000, 2_000, 4_000, 8_000]);
	});

	it("is capped at maxDelayMs however many attempts failed", () => {
		expect(kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, 50, NO_JITTER)).toBe(30_000);
		expect(kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, 10_000, NO_JITTER)).toBe(30_000);
	});

	it("keeps jitter within ± jitterRatio of the capped delay", () => {
		for (const attempt of [1, 3, 6, 40]) {
			const capped = kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, attempt, NO_JITTER);
			const low = kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, attempt, LOWEST);
			const high = kafkaConnectRetryDelayMs(DEFAULT_KAFKA_CONNECT_BACKOFF, attempt, HIGHEST);

			expect(low).toBe(Math.round(capped * (1 - DEFAULT_KAFKA_CONNECT_BACKOFF.jitterRatio)));
			expect(high).toBeLessThanOrEqual(Math.round(capped * (1 + DEFAULT_KAFKA_CONNECT_BACKOFF.jitterRatio)));
			expect(high).toBeGreaterThan(capped);
		}
	});
});

describe("KafkaConnectBackoffPolicySchema", () => {
	it("rejects a policy that could hot-loop or never back off", () => {
		expect(KafkaConnectBackoffPolicySchema.safeParse({ initialDelayMs: 0, maxDelayMs: 1_000, multiplier: 2, jitterRatio: 0.2 }).success).toBe(false);
		expect(KafkaConnectBackoffPolicySchema.safeParse({ initialDelayMs: 1_000, maxDelayMs: 500, multiplier: 2, jitterRatio: 0.2 }).success).toBe(false);
		expect(KafkaConnectBackoffPolicySchema.safeParse({ initialDelayMs: 1_000, maxDelayMs: 5_000, multiplier: 0.5, jitterRatio: 0.2 }).success).toBe(false);
		expect(KafkaConnectBackoffPolicySchema.safeParse({ initialDelayMs: 1_000, maxDelayMs: 5_000, multiplier: 2, jitterRatio: 1.5 }).success).toBe(false);
	});
});
