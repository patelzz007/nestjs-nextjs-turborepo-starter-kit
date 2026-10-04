import { Injectable } from "@nestjs/common";

import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { OUTBOX_RETENTION_OPERATION } from "./outbox-retention.constants";

/** Settled outbox states the retention job deletes; PENDING rows are never touched. */
export type SettledOutboxStatus = "PUBLISHED" | "FAILED";

/**
 * Deletes settled `outbox_events` rows. `outbox_events` is append-only for
 * app sessions and bypass-only for everything else (rls.sql), so every batch
 * runs in its own short `outbox.retention` system-operation transaction.
 */
@Injectable()
export class OutboxRetentionRepository {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	/**
	 * Delete up to `batchSize` rows in `status` that settled before
	 * `cutoffEpochMs` (oldest first). Returns the number deleted.
	 *
	 * - PUBLISHED rows settle at `published_at`.
	 * - FAILED (dead-lettered) rows settle at `updated_at` (stamped when the
	 *   dispatcher dead-letters them; an operator reset back to PENDING moves
	 *   the row out of this set).
	 *
	 * The DELETE re-checks the status and settle time on the rows it locks, so
	 * a row an operator just reset to PENDING is never deleted. The extra
	 * `created_at` bound is implied by the settle time (a row settles after it
	 * is created) and lets Postgres use the `(status, created_at)` index.
	 */
	public async deleteSettledBefore(status: SettledOutboxStatus, cutoffEpochMs: number, batchSize: number): Promise<number> {
		const cutoff = BigInt(cutoffEpochMs);
		const settledBefore = status === "PUBLISHED" ? { publishedAt: { lt: cutoff } } : { updatedAt: { lt: cutoff } };
		return this.tenantTx.withSystemOperation(
			{ operation: OUTBOX_RETENTION_OPERATION, reason: `Purge ${status} outbox rows past retention`, actorUserId: null },
			async (tx): Promise<number> => {
				const settled = await tx.outboxEvent.findMany({
					where: { status, createdAt: { lt: cutoff }, ...settledBefore },
					orderBy: { createdAt: "asc" },
					take: batchSize,
					select: { id: true },
				});
				if (settled.length === 0) {
					return 0;
				}
				const result = await tx.outboxEvent.deleteMany({
					where: { id: { in: settled.map((row): string => row.id) }, status, ...settledBefore },
				});
				return result.count;
			},
		);
	}
}
