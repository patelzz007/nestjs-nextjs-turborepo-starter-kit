import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** The system operation retention runs under; `app_purge_audit_batch` refuses any other (ADR 078). */
export const AUDIT_RECORD_RETENTION_OPERATION: SystemOperationName = "maintenance.audit_record_retention";

/** The audit tables retention trims (ADR 078). */
export type AuditRetentionTarget = "AUDIT_LOG" | "DATA_CHANGE_LOG";

/** Every target, in the order a run processes them. */
export const AUDIT_RETENTION_TARGETS: readonly AuditRetentionTarget[] = ["AUDIT_LOG", "DATA_CHANGE_LOG"];

/** What a dry pass over one target found. */
export interface AuditRetentionCount {
	/** Rows past the cutoff that would be removed. */
	readonly eligible: number;
	/** Rows past the cutoff an active legal hold keeps. */
	readonly held: number;
}

/** One finished run over one target, as recorded in `RetentionRun`. */
export interface AuditRetentionRunRecord {
	readonly target: AuditRetentionTarget;
	readonly cutoff: number;
	readonly dryRun: boolean;
	readonly deletedCount: number;
	readonly heldBackCount: number;
	readonly startedAt: number;
	readonly finishedAt: number;
	readonly outcome: "COMPLETED" | "FAILED";
	readonly failureReason: string | null;
}

/**
 * The retention store. Every call runs in its own transaction under the `maintenance.audit_record_retention`
 * system operation, through `app_purge_audit_batch`: the only way an audit row is ever deleted. The
 * database, not this port, enforces the retention floor, the batch cap and legal holds (ADR 078 §3).
 */
export interface AuditRetentionPort {
	count(actor: ActorContext, target: AuditRetentionTarget, cutoff: number): Promise<AuditRetentionCount>;
	/** Removes up to `batchSize` of the oldest eligible rows; returns how many went. */
	purgeBatch(actor: ActorContext, target: AuditRetentionTarget, cutoff: number, batchSize: number): Promise<number>;
	recordRun(actor: ActorContext, run: AuditRetentionRunRecord): Promise<void>;
}

export const AUDIT_RETENTION = Symbol("AUDIT_RETENTION");
