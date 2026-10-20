import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { HttpAuditLogSummary, PaginatedServiceResult } from "@workspace/shared";

import { AUDIT_READ_OPERATION } from "../../audit-read-operations";
import { AUDIT_READ_SESSION, type AuditReadScope, type AuditReadSession } from "../../ports/audit-read-session.port";
import { ListHttpAuditLogsQuery } from "./list-http-audit-logs.query";

/**
 * `GET /admin/audit-logs`. Reading the audit trail is itself a sensitive read (rules/10): the page
 * and its own audit row (what was released, never the records) commit together, before anything
 * leaves the server.
 */
@QueryHandler(ListHttpAuditLogsQuery)
export class ListHttpAuditLogsHandler implements IQueryHandler<ListHttpAuditLogsQuery, PaginatedServiceResult<HttpAuditLogSummary>> {
	public constructor(@Inject(AUDIT_READ_SESSION) private readonly session: AuditReadSession) {}

	public async execute(query: ListHttpAuditLogsQuery): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		const { actor, input } = query;
		return this.session.read(
			{ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer list", actor },
			async (scope: AuditReadScope): Promise<PaginatedServiceResult<HttpAuditLogSummary>> => {
				const page = await scope.httpAuditLogs.list(input);
				await scope.sensitiveReads.record({ auditLogView: { view: "list", returned: page.items.length, total: page.total, page: page.page } });
				return page;
			},
		);
	}
}
