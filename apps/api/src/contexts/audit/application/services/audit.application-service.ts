import { Inject, Injectable } from "@nestjs/common";
import type {
	AuditTrailEntry,
	AuditTrailListQuery,
	DataChangeLogDetail,
	DataChangeLogIdParam,
	DataChangeLogListQuery,
	DataChangeLogSummary,
	HttpAuditLogDetail,
	HttpAuditLogIdParam,
	HttpAuditLogListQuery,
	HttpAuditLogSummary,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AUDIT_READ_OPERATION, AUDIT_TRAIL_READ_OPERATION, DATA_CHANGE_READ_OPERATION, missingAuditRecord } from "../audit-read-operations";
import { AUDIT_READ_SESSION, type AuditReadScope, type AuditReadSession } from "../ports/audit-read-session.port";

/**
 * The admin reads of both audit stores (ADR 096): the HTTP request trail (`AuditLog`, ADR 025), the row-level
 * data-change trail (`DataChangeLog`, ADR 051) and the two as one timeline. Reading the audit trail is itself a
 * sensitive read (rules/10): each page or record commits together with its own audit row, before anything leaves
 * the server. An unknown id is a 404 and writes no sensitive-read row.
 */
@Injectable()
export class AuditApplicationService {
	public constructor(@Inject(AUDIT_READ_SESSION) private readonly session: AuditReadSession) {}

	/** `GET /admin/audit-logs`: what the page released is recorded, never the records themselves. */
	public async listHttpAuditLogs(actor: ActorContext, input: HttpAuditLogListQuery): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		return this.session.read(
			{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer list", actor },
			async (scope: AuditReadScope): Promise<PaginatedServiceResult<HttpAuditLogSummary>> => {
				const page = await scope.httpAuditLogs.list(input);
				await scope.sensitiveReads.record({ auditLogView: { view: "list", returned: page.items.length, total: page.total, page: page.page } });
				return page;
			},
		);
	}

	/** `GET /admin/audit-logs/:id`: an opened record records which one. */
	public async getHttpAuditLog(actor: ActorContext, input: HttpAuditLogIdParam): Promise<HttpAuditLogDetail> {
		return this.session.read({ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer detail", actor }, async (scope: AuditReadScope): Promise<HttpAuditLogDetail> => {
			const detail = await scope.httpAuditLogs.findById(input.id);
			if (detail === null) {
				throw missingAuditRecord(input.id);
			}
			await scope.sensitiveReads.record({ auditLogView: { view: "detail", auditLogId: detail.id, correlationId: detail.correlationId } });
			return detail;
		});
	}

	/** `GET /admin/data-changes`: the page and who looked with which filters commit together. */
	public async listDataChanges(actor: ActorContext, input: DataChangeLogListQuery): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		return this.session.read(
			{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer list", actor },
			async (scope: AuditReadScope): Promise<PaginatedServiceResult<DataChangeLogSummary>> => {
				const page = await scope.dataChangeLogs.list(input);
				await scope.sensitiveReads.record({ dataChangeView: { view: "list", returned: page.items.length, total: page.total, page: page.page } });
				return page;
			},
		);
	}

	/** `GET /admin/data-changes/:id`: an opened record records which row it showed. */
	public async getDataChange(actor: ActorContext, input: DataChangeLogIdParam): Promise<DataChangeLogDetail> {
		return this.session.read(
			{ operation: DATA_CHANGE_READ_OPERATION, reason: "Admin data-change viewer detail", actor },
			async (scope: AuditReadScope): Promise<DataChangeLogDetail> => {
				const detail = await scope.dataChangeLogs.findById(input.id);
				if (detail === null) {
					throw missingAuditRecord(input.id);
				}
				await scope.sensitiveReads.record({
					dataChangeView: { view: "detail", dataChangeId: detail.id, tableName: detail.tableName, rowId: detail.rowId, correlationId: detail.correlationId },
				});
				return detail;
			},
		);
	}

	/** `GET /admin/audit-trail`: HTTP requests and background database writes as ONE timeline (ADR 051). */
	public async listAuditTrail(actor: ActorContext, input: AuditTrailListQuery): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		return this.session.read(
			{ operation: AUDIT_TRAIL_READ_OPERATION, reason: "Admin audit log timeline", actor },
			async (scope: AuditReadScope): Promise<PaginatedServiceResult<AuditTrailEntry>> => {
				const page = await scope.auditTrail.list(input);
				await scope.sensitiveReads.record({ auditTrailView: { returned: page.items.length, total: page.total, page: page.page } });
				return page;
			},
		);
	}
}
