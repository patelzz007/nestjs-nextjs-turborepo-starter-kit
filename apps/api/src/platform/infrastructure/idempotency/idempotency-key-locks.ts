import type { IdempotencyRecordKey } from "./idempotency-record.repository";

/** A held key lock. `release` never throws: a lock that cannot be released cleanly is dropped with its session. */
export interface IdempotencyKeyLock {
	release(): Promise<void>;
}

/** Outcome of {@link IdempotencyKeyLocks.acquire}. */
export type IdempotencyKeyLockOutcome = { readonly kind: "locked"; readonly lock: IdempotencyKeyLock } | { readonly kind: "timed_out" };

/**
 * Mutual exclusion per (scope, key) across every API instance. The request that
 * executes holds the key's lock for the length of its handler; an identical
 * duplicate blocks in `acquire` until the holder releases it — no polling — or
 * `waitMs` passes.
 */
export interface IdempotencyKeyLocks {
	acquire(key: IdempotencyRecordKey, waitMs: number): Promise<IdempotencyKeyLockOutcome>;
}

export const IDEMPOTENCY_KEY_LOCKS = Symbol("IDEMPOTENCY_KEY_LOCKS");
