import { z } from "zod";

/** Retry schedule for (re)establishing a Kafka connection in the background. */
export const KafkaConnectBackoffPolicySchema = z
	.object({
		/** Delay before the 2nd attempt (ms). */
		initialDelayMs: z.number().int().min(100),
		/** Upper bound of the exponential delay, before jitter (ms). */
		maxDelayMs: z.number().int().positive(),
		/** Growth factor per failed attempt. */
		multiplier: z.number().min(1),
		/** ± share of the delay applied as random jitter, so many instances do not retry in lockstep. */
		jitterRatio: z.number().min(0).max(1),
	})
	.refine((policy): boolean => policy.maxDelayMs >= policy.initialDelayMs, { message: "maxDelayMs must be ≥ initialDelayMs" });

export type KafkaConnectBackoffPolicy = z.output<typeof KafkaConnectBackoffPolicySchema>;

/**
 * Default schedule: 1 s, 2 s, 4 s … capped at 30 s, ±20 %. A broker that
 * comes back is picked up within ~36 s at worst; a broker that stays down
 * costs one attempt per ~30 s.
 */
export const DEFAULT_KAFKA_CONNECT_BACKOFF: KafkaConnectBackoffPolicy = KafkaConnectBackoffPolicySchema.parse({
	initialDelayMs: 1_000,
	maxDelayMs: 30_000,
	multiplier: 2,
	jitterRatio: 0.2,
});

/**
 * Delay after failed attempt number `failedAttempt` (1-based):
 * `initial × multiplier^(failedAttempt-1)`, capped at `maxDelayMs`, then
 * ±`jitterRatio`. `random` returns a value in [0, 1). The result always lies
 * in `[capped × (1 − jitter), capped × (1 + jitter)]`.
 */
export function kafkaConnectRetryDelayMs(policy: KafkaConnectBackoffPolicy, failedAttempt: number, random: () => number): number {
	const exponential = policy.initialDelayMs * policy.multiplier ** Math.max(0, failedAttempt - 1);
	const capped = Math.min(exponential, policy.maxDelayMs);
	const jitter = capped * policy.jitterRatio * (random() * 2 - 1);
	return Math.round(capped + jitter);
}
