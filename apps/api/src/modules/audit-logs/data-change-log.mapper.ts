import type { DataChangeLog } from "@prisma/client";
import { DataChangeLogDetailSchema, DataChangeLogSummarySchema, epochMs, type DataChangeLogDetail, type DataChangeLogSummary } from "@workspace/shared";

import { distinctReferenceIds, toAuditLogOrganization, toAuditLogUser, type AuditLogReferenceIds, type AuditLogReferences } from "./audit-references";
import type { DataChangeLogSummaryRow } from "./repositories/data-change-log.repository";

/** Every distinct actor and organization id the rows name. */
export function dataChangeLogReferenceIds(rows: readonly Pick<DataChangeLogSummaryRow, "actorUserId" | "organizationId">[]): AuditLogReferenceIds {
	return {
		userIds: distinctReferenceIds(rows.map((row) => row.actorUserId)),
		organizationIds: distinctReferenceIds(rows.map((row) => row.organizationId)),
	};
}

/** A list row → the public summary contract (bigints → numbers, ids → resolved references). */
export function toDataChangeLogSummary(row: DataChangeLogSummaryRow, references: AuditLogReferences): DataChangeLogSummary {
	return DataChangeLogSummarySchema.parse({
		id: row.id,
		changeSequence: Number(row.changeSequence),
		occurredAt: epochMs(Number(row.occurredAt)),
		transactionId: Number(row.transactionId),
		tableName: row.tableName,
		operation: row.operation,
		rowId: row.rowId,
		changedColumns: row.changedColumns,
		actorKind: row.actorKind,
		actor: toAuditLogUser(row.actorUserId, references),
		organization: toAuditLogOrganization(row.organizationId, references),
		apiKeyId: row.apiKeyId,
		systemOperation: row.systemOperation,
		correlationId: row.correlationId,
		databaseRole: row.databaseRole,
	});
}

/** A complete row → the public detail contract (the summary plus the redacted row images and connection facts). */
export function toDataChangeLogDetail(row: DataChangeLog, references: AuditLogReferences): DataChangeLogDetail {
	return DataChangeLogDetailSchema.parse({
		...toDataChangeLogSummary(row, references),
		oldData: row.oldData,
		newData: row.newData,
		actorPurpose: row.actorPurpose,
		loginRole: row.loginRole,
		applicationName: row.applicationName,
		clientAddress: row.clientAddress,
		createdAt: epochMs(Number(row.createdAt)),
	});
}
