import type {
	AuditTrailEntry,
	AuditTrailListQuery,
	DataChangeLogDetail,
	DataChangeLogListQuery,
	DataChangeLogSummary,
	HttpAuditLogDetail,
	HttpAuditLogListQuery,
	HttpAuditLogSummary,
	JsonValue,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Read side of the HTTP request trail (`AuditLog`, ADR 025), already mapped to the public contract. */
export interface HttpAuditLogReader {
	/** One page of records matching the (already validated) list query, payloads excluded, names resolved. */
	list(query: HttpAuditLogListQuery): Promise<PaginatedServiceResult<HttpAuditLogSummary>>;
	/** One complete record, or `null` when no record has this id. */
	findById(id: string): Promise<HttpAuditLogDetail | null>;
}

/** Read side of the row-level data-change trail (`DataChangeLog`, ADR 051), already mapped to the public contract. */
export interface DataChangeLogReader {
	/** One page of change records matching the (already validated) list query, row images excluded, names resolved. */
	list(query: DataChangeLogListQuery): Promise<PaginatedServiceResult<DataChangeLogSummary>>;
	/** One complete change record, or `null` when no record has this id. */
	findById(id: string): Promise<DataChangeLogDetail | null>;
}

/** Both audit stores as one timeline (ADR 051). */
export interface AuditTrailReader {
	/** One page of timeline entries, each with its change summary and names resolved. */
	list(query: AuditTrailListQuery): Promise<PaginatedServiceResult<AuditTrailEntry>>;
}

/**
 * Records the current request as a SENSITIVE READ (rules/10): its one audit row, with `summary`
 * (what was released, never the records) as the response body. Written in the read's own
 * transaction, so a row that cannot be written fails the read and nothing is released unaudited.
 */
export interface SensitiveReadRecorder {
	record(summary: JsonValue): Promise<void>;
}

/** Everything one audit read can touch. Every member is bound to that read's transaction. */
export interface AuditReadScope {
	readonly httpAuditLogs: HttpAuditLogReader;
	readonly dataChangeLogs: DataChangeLogReader;
	readonly auditTrail: AuditTrailReader;
	readonly sensitiveReads: SensitiveReadRecorder;
}

/** Which allowlisted system operation a read runs under, why, and for whom. */
export interface AuditReadRequest {
	readonly operation: SystemOperationName;
	/** The audit line of the system-operation transaction. */
	readonly reason: string;
	readonly actor: ActorContext;
}

/**
 * Opens one read of the audit stores. Both stores are bypass-only under RLS (no tenant or user
 * policy could ever admit a row), so a read cannot run in the caller's RLS session the way
 * `PrismaReadExecutor` reads do: it runs as an allowlisted system operation instead, after the
 * controller's AUDIT_LOG permission check, with the actor recorded as the operation's user.
 */
export interface AuditReadSession {
	read<TResult>(request: AuditReadRequest, work: (scope: AuditReadScope) => Promise<TResult>): Promise<TResult>;
}

export const AUDIT_READ_SESSION = Symbol("AUDIT_READ_SESSION");
