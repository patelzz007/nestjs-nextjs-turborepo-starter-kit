import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, purgeInBatches, type BatchedPurgePolicy, type BatchedPurgeResult } from "@workspace/shared";

import { IdempotencyRecordRepository } from "./idempotency-record.repository";
import { IDEMPOTENCY_PURGE_BATCH_SIZE, IDEMPOTENCY_PURGE_GRACE_MS, IDEMPOTENCY_PURGE_TIME_BUDGET_MS } from "./idempotency.constants";

/** Batching for one retention run (bounded transactions, bounded run time). */
export const IDEMPOTENCY_PURGE_POLICY: BatchedPurgePolicy = {
	batchSize: IDEMPOTENCY_PURGE_BATCH_SIZE,
	timeBudgetMs: IDEMPOTENCY_PURGE_TIME_BUDGET_MS,
};

/** Outcome of one retention run — also the structured `idempotency.retention_summary` log line. */
export interface IdempotencyRetentionSummary extends BatchedPurgeResult {
	/** Records whose `expiresAt` is before this instant were eligible. */
	readonly cutoffEpochMs: number;
}

/**
 * Deletes `platform_resource_idempotency_records` rows that expired more than
 * {@link IDEMPOTENCY_PURGE_GRACE_MS} ago. Driven hourly by the
 * `idempotency.retention` BullMQ scheduler (`IdempotencyRetentionProcessor`).
 *
 * Safe to run twice or concurrently: every batch is a conditional DELETE of
 * rows that are already semantically gone (the service treats an expired row
 * like a missing one), so a double-fire only finds less to delete.
 */
@Injectable()
export class IdempotencyRetentionService {
	private readonly logger: Logger = new Logger(IdempotencyRetentionService.name);

	public constructor(private readonly records: IdempotencyRecordRepository) {}

	public async purgeExpired(): Promise<IdempotencyRetentionSummary> {
		const cutoffEpochMs: number = nowEpochMs() - IDEMPOTENCY_PURGE_GRACE_MS;
		const result: BatchedPurgeResult = await purgeInBatches(
			async (batchSize: number): Promise<number> => this.records.deleteExpiredBefore(cutoffEpochMs, batchSize),
			IDEMPOTENCY_PURGE_POLICY,
			nowEpochMs,
		);
		const summary: IdempotencyRetentionSummary = { ...result, cutoffEpochMs };

		const entry = { event: "idempotency.retention_summary", ...summary };
		if (summary.stoppedBy === "time_budget") {
			// Not an error: the next run continues. Repeated warnings mean the
			// table grows faster than one run per interval can drain it.
			this.logger.warn(entry);
		} else {
			this.logger.log(entry);
		}
		return summary;
	}
}
