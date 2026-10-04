import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs, purgeInBatches, type BatchedPurgePolicy, type BatchedPurgeResult } from "@workspace/shared";

import { OUTBOX_DEAD_LETTER_RETENTION_MS, OUTBOX_PUBLISHED_RETENTION_MS, OUTBOX_PURGE_BATCH_SIZE, OUTBOX_PURGE_TIME_BUDGET_MS } from "./outbox-retention.constants";
import { OutboxRetentionRepository, type SettledOutboxStatus } from "./outbox-retention.repository";

/** Batching for one retention pass (bounded transactions, bounded run time). */
export const OUTBOX_PURGE_POLICY: BatchedPurgePolicy = {
	batchSize: OUTBOX_PURGE_BATCH_SIZE,
	timeBudgetMs: OUTBOX_PURGE_TIME_BUDGET_MS,
};

/** Outcome of purging one settled status. */
export interface OutboxStatusPurgeSummary extends BatchedPurgeResult {
	/** Rows that settled before this instant were eligible. */
	readonly cutoffEpochMs: number;
}

/** Outcome of one retention run — also the structured `outbox.retention_summary` log line. */
export interface OutboxRetentionSummary {
	readonly published: OutboxStatusPurgeSummary;
	readonly deadLettered: OutboxStatusPurgeSummary;
}

/**
 * Keeps `outbox_events` bounded: deletes PUBLISHED rows older than
 * {@link OUTBOX_PUBLISHED_RETENTION_MS} and dead-lettered (FAILED) rows older
 * than {@link OUTBOX_DEAD_LETTER_RETENTION_MS}. PENDING rows are never
 * deleted — they are undelivered events. Driven hourly by the
 * `outbox.retention` BullMQ scheduler (`OutboxRetentionProcessor`).
 *
 * Safe to run twice or concurrently: every batch is a conditional DELETE of
 * settled rows, so a double-fire only finds less to delete.
 */
@Injectable()
export class OutboxRetentionService {
	private readonly logger: Logger = new Logger(OutboxRetentionService.name);

	public constructor(private readonly rows: OutboxRetentionRepository) {}

	public async purgeSettled(): Promise<OutboxRetentionSummary> {
		const published = await this.purgeStatus("PUBLISHED", OUTBOX_PUBLISHED_RETENTION_MS);
		const deadLettered = await this.purgeStatus("FAILED", OUTBOX_DEAD_LETTER_RETENTION_MS);
		const summary: OutboxRetentionSummary = { published, deadLettered };

		const entry = { event: "outbox.retention_summary", ...summary };
		if (published.stoppedBy === "time_budget" || deadLettered.stoppedBy === "time_budget" || deadLettered.deleted > 0) {
			// Not an error, but worth a look: a time-budget stop means the table
			// grows faster than one run per interval drains it, and a deleted
			// dead letter is an event nobody replayed within its retention window.
			this.logger.warn(entry);
		} else {
			this.logger.log(entry);
		}
		return summary;
	}

	private async purgeStatus(status: SettledOutboxStatus, retentionMs: number): Promise<OutboxStatusPurgeSummary> {
		const cutoffEpochMs: number = nowEpochMs() - retentionMs;
		const result: BatchedPurgeResult = await purgeInBatches(
			async (batchSize: number): Promise<number> => this.rows.deleteSettledBefore(status, cutoffEpochMs, batchSize),
			OUTBOX_PURGE_POLICY,
			nowEpochMs,
		);
		return { ...result, cutoffEpochMs };
	}
}
