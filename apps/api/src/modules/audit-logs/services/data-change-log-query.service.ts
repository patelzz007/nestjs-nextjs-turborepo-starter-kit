import { HttpStatus, Injectable } from "@nestjs/common";
import type { DataChangeLog, Prisma } from "@prisma/client";
import type { DataChangeLogDetail, DataChangeLogListQuery, DataChangeLogSummary, PaginatedServiceResult } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import type { AuditLogReferences } from "../audit-references";
import { dataChangeLogReferenceIds, toDataChangeLogDetail, toDataChangeLogSummary } from "../data-change-log.mapper";
import { AuditReferenceRepository } from "../repositories/audit-reference.repository";
import { DataChangeLogRepository, type DataChangeLogSummaryRow } from "../repositories/data-change-log.repository";

/** Allowlisted system operation every data-change-trail read runs under (system-operation.registry.ts). */
export const DATA_CHANGE_READ_OPERATION = "audit.data_change.read";

/**
 * Application service behind the admin data-change viewer
 * (`GET /admin/data-changes`, `GET /admin/data-changes/:id`, ADR 051).
 *
 * - `data_change_logs` is bypass-only under RLS, so every read runs under the
 *   allowlisted `audit.data_change.read` operation — after the controller's
 *   AUDIT_LOG permission check.
 * - Reading the trail is itself a sensitive read (rules/10): each page and each
 *   opened record writes its own HTTP audit row (who looked, from where, with
 *   which filters) BEFORE the data leaves the server. If that row cannot be
 *   written the read fails — nothing is released unaudited.
 */
@Injectable()
export class DataChangeLogQueryService {
	public constructor(
		private readonly repository: DataChangeLogRepository,
		private readonly references: AuditReferenceRepository,
		private readonly tenantTx: TenantTransactionService,
		private readonly auditTrail: AuditTrailService,
	) {}

	/** One page of change records (newest first by default), with actor and organization names resolved. */
	public async list(actorId: string, query: DataChangeLogListQuery, request: FastifyRequest): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		const page: RepositoryListResult<DataChangeLogSummary> = await this.tenantTx.withSystemOperation(
			{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer list", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<RepositoryListResult<DataChangeLogSummary>> => {
				const rows: RepositoryListResult<DataChangeLogSummaryRow> = await this.repository.list(query, tx);
				const references: AuditLogReferences = await this.references.load(dataChangeLogReferenceIds(rows.items), tx);
				return mapListResult(rows, (row: DataChangeLogSummaryRow): DataChangeLogSummary => toDataChangeLogSummary(row, references));
			},
		);
		await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, {
			dataChangeView: { view: "list", returned: page.items.length, total: page.total, page: page.page },
		});
		return toPaginatedServiceResult(page, query);
	}

	/** One complete change record. Throws {@link ResourceNotFoundError} when no record has this id. */
	public async getById(actorId: string, id: string, request: FastifyRequest): Promise<DataChangeLogDetail> {
		const detail: DataChangeLogDetail | null = await this.tenantTx.withSystemOperation(
			{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer detail", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<DataChangeLogDetail | null> => {
				const row: DataChangeLog | null = await this.repository.findById(id, tx);
				return row === null ? null : toDataChangeLogDetail(row, await this.references.load(dataChangeLogReferenceIds([row]), tx));
			},
		);
		if (detail === null) {
			throw new ResourceNotFoundError(id);
		}
		await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, {
			dataChangeView: { view: "detail", dataChangeId: detail.id, tableName: detail.tableName, rowId: detail.rowId, correlationId: detail.correlationId },
		});
		return detail;
	}
}
