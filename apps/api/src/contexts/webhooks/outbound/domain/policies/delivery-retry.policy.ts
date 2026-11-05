import { epochMs, type EpochMs } from "@workspace/shared";

/**
 * When a failed delivery is tried again (ADR 082): exponential back-off from `baseDelayMs`, doubling per
 * attempt up to `maxDelayMs`, with ± `jitterRatio` random jitter so a recovering endpoint is not hit by
 * every retry at once. After `maxAttempts` the delivery is DEAD.
 */
export interface DeliveryRetryPolicy {
	readonly maxAttempts: number;
	readonly baseDelayMs: number;
	readonly maxDelayMs: number;
	readonly jitterRatio: number;
}

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const BACKOFF_MULTIPLIER = 2;

/** Ten attempts over about three hours: 30 s, 1, 2, 4, 8, 16, 32 minutes, then hourly. */
export const WEBHOOK_DELIVERY_RETRY_POLICY: DeliveryRetryPolicy = {
	maxAttempts: 10,
	baseDelayMs: 30 * MS_PER_SECOND,
	maxDelayMs: 60 * MS_PER_MINUTE,
	jitterRatio: 0.2,
};

/** The delay before attempt `attempt + 1`, after `attempt` failed (`random` in [0, 1)). */
export function deliveryRetryDelayMs(policy: DeliveryRetryPolicy, attempt: number, random: () => number): number {
	const exponential = policy.baseDelayMs * BACKOFF_MULTIPLIER ** Math.max(0, attempt - 1);
	const capped = Math.min(exponential, policy.maxDelayMs);
	const jitter = capped * policy.jitterRatio * (random() * BACKOFF_MULTIPLIER - 1);
	return Math.max(0, Math.round(capped + jitter));
}

/** Where a delivery goes after one attempt. */
export type DeliveryTransition =
	| { readonly status: "SUCCEEDED"; readonly attempts: number; readonly deliveredAt: EpochMs; readonly nextAttemptAt: null }
	| { readonly status: "FAILED"; readonly attempts: number; readonly deliveredAt: null; readonly nextAttemptAt: EpochMs }
	| { readonly status: "DEAD"; readonly attempts: number; readonly deliveredAt: null; readonly nextAttemptAt: null };

/** The delivery's next state, given the attempts made before this one and whether this one succeeded. */
export function nextDeliveryState(previousAttempts: number, succeeded: boolean, now: EpochMs, policy: DeliveryRetryPolicy, random: () => number): DeliveryTransition {
	const attempts = previousAttempts + 1;
	if (succeeded) {
		return { status: "SUCCEEDED", attempts, deliveredAt: now, nextAttemptAt: null };
	}
	if (attempts >= policy.maxAttempts) {
		return { status: "DEAD", attempts, deliveredAt: null, nextAttemptAt: null };
	}
	return { status: "FAILED", attempts, deliveredAt: null, nextAttemptAt: epochMs(now + deliveryRetryDelayMs(policy, attempts, random)) };
}
