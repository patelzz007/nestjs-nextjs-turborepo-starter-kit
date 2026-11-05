import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { RECORD_RETENTION_MS } from "../../../../../platform/domain/record-retention";
import { AUDIT_RETENTION, AUDIT_RETENTION_TARGETS, type AuditRetentionPort, type AuditRetentionRunRecord, type AuditRetentionTarget } from "../../ports/audit-retention.port";
import { PurgeExpiredAuditRecordsCommand } from "./purge-expired-audit-records.command";

/** Rows removed per transaction: small enough that no single transaction holds a large delete (ADR 078). */
export const AUDIT_RETENTION_BATCH_SIZE = 5_000;

/**
 * One retention run: for each audit table, count what is past the cutoff and what legal holds keep, then
 * (unless dry) delete in batches until a batch comes back short, and record the run, failed or not. The
 * cutoff comes from the clock and the platform retention only, never from a caller; the database checks
 * it again. A rerun after a crash simply continues.
 */
@CommandHandler(PurgeExpiredAuditRecordsCommand)
export class PurgeExpiredAuditRecordsHandler implements ICommandHandler<PurgeExpiredAuditRecordsCommand, readonly AuditRetentionRunRecord[]> {
	public constructor(
		@Inject(AUDIT_RETENTION) private readonly retention: AuditRetentionPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: PurgeExpiredAuditRecordsCommand): Promise<readonly AuditRetentionRunRecord[]> {
		const runs: AuditRetentionRunRecord[] = [];
		for (const target of AUDIT_RETENTION_TARGETS) {
			runs.push(await this.runTarget(command, target));
		}
		return runs;
	}

	private async runTarget(command: PurgeExpiredAuditRecordsCommand, target: AuditRetentionTarget): Promise<AuditRetentionRunRecord> {
		const startedAt = this.clock.now();
		const cutoff = startedAt - RECORD_RETENTION_MS;
		let deleted = 0;
		let held = 0;
		let run: AuditRetentionRunRecord;
		try {
			const counted = await this.retention.count(command.actor, target, cutoff);
			held = counted.held;
			if (command.dryRun) {
				deleted = counted.eligible;
			} else {
				let removed = AUDIT_RETENTION_BATCH_SIZE;
				while (removed === AUDIT_RETENTION_BATCH_SIZE) {
					removed = await this.retention.purgeBatch(command.actor, target, cutoff, AUDIT_RETENTION_BATCH_SIZE);
					deleted += removed;
				}
			}
			run = {
				target,
				cutoff,
				dryRun: command.dryRun,
				deletedCount: deleted,
				heldBackCount: held,
				startedAt,
				finishedAt: this.clock.now(),
				outcome: "COMPLETED",
				failureReason: null,
			};
		} catch (error) {
			const reason = error instanceof Error ? error.message : "Unknown failure";
			run = {
				target,
				cutoff,
				dryRun: command.dryRun,
				deletedCount: deleted,
				heldBackCount: held,
				startedAt,
				finishedAt: this.clock.now(),
				outcome: "FAILED",
				failureReason: reason.slice(0, FAILURE_REASON_MAX_LENGTH),
			};
		}
		await this.retention.recordRun(command.actor, run);
		return run;
	}
}

/** `RetentionRun.failureReason` is `VarChar(500)`. */
const FAILURE_REASON_MAX_LENGTH = 500;
