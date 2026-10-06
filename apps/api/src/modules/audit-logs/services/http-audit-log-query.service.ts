import { HttpStatus, Injectable } from "@nestjs/common";
import type { AuditLog, Prisma } from "@prisma/client";
import type { HttpAuditLogDetail, HttpAuditLogListQuery, HttpAuditLogSummary, PaginatedServiceResult } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { ResourceNotFoundError } from "../../../platform/persistence/persistence.errors";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import {
	referencedOrganizationIds,
	referencedUserIds,
	toAuditLogReferences,
	toHttpAuditLogDetail,
	toHttpAuditLogSummary,
	type AuditLogReferences,
} from "../http-audit-log.mapper";
import { HttpAuditLogRepository, type AuditLogSummaryRow } from "../repositories/http-audit-log.repository";

/** Allowlisted system operation every audit-trail read runs under (system-operation.registry.ts). */
export const AUDIT_READ_OPERATION = "audit.http_request.read";

/**
 * Application service behind the admin audit viewer (`GET /admin/audit-logs`,
 * `GET /admin/audit-logs/:id`).
 *
 * - `audit_logs` is bypass-only under RLS, so every read runs under the
 *   allowlisted `audit.http_request.read` operation — after the controller's
 *   AUDIT_LOG permission check.
 * - Reading the audit trail is itself a sensitive read (rules/10): each page
 *   and each opened record writes its own audit row (who looked, from where,
 *   with which filters) BEFORE the data leaves the server. If that row cannot
 *   be written the read fails — nothing is released unaudited.
 */
@Injectable()
export class HttpAuditLogQueryService {
	public constructor(
		private readonly repository: HttpAuditLogRepository,
		private readonly tenantTx: TenantTransactionService,
		private readonly auditTrail: AuditTrailService,
	) {}

	/** One page of audit records (newest first by default), with actor and organization names resolved. */
	public async list(actorId: string, query: HttpAuditLogListQuery, request: FastifyRequest): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		const page: RepositoryListResult<HttpAuditLogSummary> = await this.tenantTx.withSystemOperation(
			{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer list", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<RepositoryListResult<HttpAuditLogSummary>> => {
				const rows: RepositoryListResult<AuditLogSummaryRow> = await this.repository.list(query, tx);
				const references: AuditLogReferences = await this.loadReferences(rows.items, tx);
				return mapListResult(rows, (row: AuditLogSummaryRow): HttpAuditLogSummary => toHttpAuditLogSummary(row, references));
			},
		);
		await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, {
			auditLogView: { view: "list", returned: page.items.length, total: page.total, page: page.page },
		});
		return toPaginatedServiceResult(page, query);
	}

	/** One complete audit record. Throws {@link ResourceNotFoundError} when no record has this id. */
	public async getById(actorId: string, id: string, request: FastifyRequest): Promise<HttpAuditLogDetail> {
		const detail: HttpAuditLogDetail | null = await this.tenantTx.withSystemOperation(
			{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer detail", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<HttpAuditLogDetail | null> => {
				const row: AuditLog | null = await this.repository.findById(id, tx);
				return row === null ? null : toHttpAuditLogDetail(row, await this.loadReferences([row], tx));
			},
		);
		if (detail === null) {
			throw new ResourceNotFoundError(id);
		}
		await this.auditTrail.recordSensitiveRead(request, HttpStatus.OK, {
			auditLogView: { view: "detail", auditLogId: detail.id, correlationId: detail.correlationId },
		});
		return detail;
	}

	private async loadReferences(rows: readonly AuditLogSummaryRow[], tx: Prisma.TransactionClient): Promise<AuditLogReferences> {
		// Sequential: an interactive transaction runs its statements on one connection anyway.
		const users = await this.repository.findUsers(referencedUserIds(rows), tx);
		const organizations = await this.repository.findOrganizations(referencedOrganizationIds(rows), tx);
		return toAuditLogReferences(users, organizations);
	}
}
