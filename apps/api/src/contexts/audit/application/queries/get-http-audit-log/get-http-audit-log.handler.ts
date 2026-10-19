import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { HttpAuditLogDetail } from "@workspace/shared";

import { AUDIT_READ_OPERATION, missingAuditRecord } from "../../audit-read-operations";
import { AUDIT_READ_SESSION, type AuditReadScope, type AuditReadSession } from "../../ports/audit-read-session.port";
import { GetHttpAuditLogQuery } from "./get-http-audit-log.query";

/** `GET /admin/audit-logs/:id`. An unknown id is a 404 and writes no sensitive-read row; an opened record records which one. */
@QueryHandler(GetHttpAuditLogQuery)
export class GetHttpAuditLogHandler implements IQueryHandler<GetHttpAuditLogQuery, HttpAuditLogDetail> {
	public constructor(@Inject(AUDIT_READ_SESSION) private readonly session: AuditReadSession) {}

	public async execute(query: GetHttpAuditLogQuery): Promise<HttpAuditLogDetail> {
		const { actor, input } = query;
		return this.session.read({ operation: AUDIT_READ_OPERATION, reason: "Admin audit viewer detail", actor }, async (scope: AuditReadScope): Promise<HttpAuditLogDetail> => {
			const detail = await scope.httpAuditLogs.findById(input.id);
			if (detail === null) {
				throw missingAuditRecord(input.id);
			}
			await scope.sensitiveReads.record({ auditLogView: { view: "detail", auditLogId: detail.id, correlationId: detail.correlationId } });
			return detail;
		});
	}
}
