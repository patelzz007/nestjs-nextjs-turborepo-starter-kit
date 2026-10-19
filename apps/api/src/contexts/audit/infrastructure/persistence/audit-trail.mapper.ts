import {
	AuditTrailBackgroundEntrySchema,
	AuditTrailRequestEntrySchema,
	type AuditTrailBackgroundEntry,
	type AuditTrailEntry,
	type AuditTrailRequestEntry,
} from "@workspace/shared";

import { distinctReferenceIds, type AuditLogReferenceIds, type AuditLogReferences } from "./audit-references";
import { toDataChangeLogSummary } from "./data-change-log.mapper";
import { toHttpAuditLogSummary } from "./http-audit-log.mapper";
import { dataChangeGroupKey, type AuditTrailEntryRow, type ChangeSummaries, type ChangeSummary } from "./prisma-audit-trail.read-repository";
import type { DataChangeLogSummaryRow } from "./prisma-data-change-log.read-repository";
import type { AuditLogSummaryRow } from "./prisma-http-audit-log.read-repository";

/** The rows one page of the timeline is built from. */
export interface AuditTrailPageRows {
	readonly requests: ReadonlyMap<string, AuditLogSummaryRow>;
	readonly changes: ReadonlyMap<string, DataChangeLogSummaryRow>;
	readonly summaries: ChangeSummaries;
	readonly references: AuditLogReferences;
}

/** A request that changed no rows. */
const NO_CHANGES: ChangeSummary = { changeCount: 0, changedTables: [] };

/** The groups whose change summaries a page needs: every request's and correlated job's correlation id, and the uncorrelated entries' transactions. */
export function auditTrailChangeGroups(
	requests: readonly AuditLogSummaryRow[],
	changes: readonly DataChangeLogSummaryRow[],
): { readonly correlationIds: string[]; readonly transactionIds: bigint[] } {
	return {
		correlationIds: distinctReferenceIds([...requests.map((row) => row.correlationId), ...changes.map((row) => row.correlationId)]),
		transactionIds: [...new Set(changes.filter((row) => row.correlationId === null).map((row) => row.transactionId))],
	};
}

/** Every distinct user / organization the page's rows name. */
export function auditTrailReferenceIds(requests: readonly AuditLogSummaryRow[], changes: readonly DataChangeLogSummaryRow[]): AuditLogReferenceIds {
	return {
		userIds: distinctReferenceIds([...requests.flatMap((row) => [row.actorUserId, row.impersonatorUserId]), ...changes.map((row) => row.actorUserId)]),
		organizationIds: distinctReferenceIds([...requests.map((row) => row.organizationId), ...changes.map((row) => row.organizationId)]),
	};
}

function toRequestEntry(row: AuditLogSummaryRow, page: AuditTrailPageRows): AuditTrailRequestEntry {
	return AuditTrailRequestEntrySchema.parse({ ...toHttpAuditLogSummary(row, page.references), kind: "REQUEST", ...(page.summaries.get(row.correlationId) ?? NO_CHANGES) });
}

function toBackgroundEntry(change: DataChangeLogSummaryRow, page: AuditTrailPageRows): AuditTrailBackgroundEntry {
	const summary = toDataChangeLogSummary(change, page.references);
	// The group always holds at least this change; the fallback only covers a summary that raced the page read.
	const changes: ChangeSummary = page.summaries.get(dataChangeGroupKey(change)) ?? { changeCount: 1, changedTables: [change.tableName] };
	return AuditTrailBackgroundEntrySchema.parse({
		kind: "BACKGROUND",
		id: summary.id,
		occurredAt: summary.occurredAt,
		actorKind: summary.actorKind,
		actor: summary.actor,
		organization: summary.organization,
		apiKeyId: summary.apiKeyId,
		systemOperation: summary.systemOperation,
		correlationId: summary.correlationId,
		databaseRole: summary.databaseRole,
		operation: summary.operation,
		rowId: summary.rowId,
		...changes,
	});
}

/**
 * One timeline position → its public entry. `null` when the record vanished
 * between the two reads — impossible for append-only tables, so it is dropped
 * rather than invented.
 */
export function toAuditTrailEntry(position: AuditTrailEntryRow, page: AuditTrailPageRows): AuditTrailEntry | null {
	if (position.kind === "REQUEST") {
		const row = page.requests.get(position.id);
		return row === undefined ? null : toRequestEntry(row, page);
	}
	const change = page.changes.get(position.id);
	return change === undefined ? null : toBackgroundEntry(change, page);
}
