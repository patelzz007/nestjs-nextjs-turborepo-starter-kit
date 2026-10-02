// ============================================
// batched-purge.ts - Bounded, time-boxed retention deletes
// ============================================
// Shared by every retention job (API idempotency ledger, analytics-consumer
// inbox) so each one deletes in small transactions and gives up after a time
// budget instead of holding locks or a connection for an unbounded time. The
// caller owns the SQL; this only owns the loop.

/** Batch size and time budget for one retention run. */
export interface BatchedPurgePolicy {
	/** Maximum rows deleted per batch (one short transaction each). */
	readonly batchSize: number;
	/** Wall-clock budget for one run. No new batch starts once it is spent; the next run continues. */
	readonly timeBudgetMs: number;
}

/** Why a run stopped: nothing left to delete, or the time budget ran out (a backlog remains). */
export type BatchedPurgeStopReason = "drained" | "time_budget";

export interface BatchedPurgeResult {
	readonly deleted: number;
	readonly batches: number;
	readonly durationMs: number;
	readonly stoppedBy: BatchedPurgeStopReason;
}

/** Deletes up to `batchSize` rows and returns how many it deleted. */
export type PurgeBatch = (batchSize: number) => Promise<number>;

/**
 * Run `deleteBatch` until a batch deletes fewer than `batchSize` rows
 * (drained) or `timeBudgetMs` has elapsed (checked before every batch after
 * the first, so one run always makes progress). Errors propagate unchanged —
 * the scheduler retries the whole run, and every batch is idempotent.
 */
export async function purgeInBatches(deleteBatch: PurgeBatch, policy: BatchedPurgePolicy, nowMs: () => number): Promise<BatchedPurgeResult> {
	assertValidPolicy(policy);

	const startedAt: number = nowMs();
	let deleted = 0;
	let batches = 0;

	for (;;) {
		if (batches > 0 && nowMs() - startedAt >= policy.timeBudgetMs) {
			return { deleted, batches, durationMs: nowMs() - startedAt, stoppedBy: "time_budget" };
		}

		const count: number = await deleteBatch(policy.batchSize);
		deleted += count;
		batches += 1;

		if (count < policy.batchSize) {
			return { deleted, batches, durationMs: nowMs() - startedAt, stoppedBy: "drained" };
		}
	}
}

function assertValidPolicy(policy: BatchedPurgePolicy): void {
	if (!Number.isSafeInteger(policy.batchSize) || policy.batchSize < 1) {
		throw new RangeError(`batchSize must be a positive integer (got ${String(policy.batchSize)})`);
	}
	if (!Number.isSafeInteger(policy.timeBudgetMs) || policy.timeBudgetMs < 0) {
		throw new RangeError(`timeBudgetMs must be a non-negative integer (got ${String(policy.timeBudgetMs)})`);
	}
}
