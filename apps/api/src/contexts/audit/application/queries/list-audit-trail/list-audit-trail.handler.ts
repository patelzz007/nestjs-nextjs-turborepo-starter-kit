import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AuditTrailEntry, PaginatedServiceResult } from "@workspace/shared";

import { AUDIT_TRAIL_READ_OPERATION } from "../../audit-read-operations";
import { AUDIT_READ_SESSION, type AuditReadScope, type AuditReadSession } from "../../ports/audit-read-session.port";
import { ListAuditTrailQuery } from "./list-audit-trail.query";

/**
 * `GET /admin/audit-trail`: HTTP requests and background database writes as ONE timeline (ADR 051).
 * Each page is a sensitive read (rules/10): it commits with its own audit row or not at all.
 */
@QueryHandler(ListAuditTrailQuery)
export class ListAuditTrailHandler implements IQueryHandler<ListAuditTrailQuery, PaginatedServiceResult<AuditTrailEntry>> {
	public constructor(@Inject(AUDIT_READ_SESSION) private readonly session: AuditReadSession) {}

	public async execute(query: ListAuditTrailQuery): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		const { actor, input } = query;
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
