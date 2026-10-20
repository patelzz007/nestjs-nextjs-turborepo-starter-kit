import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AuditLogEntry, PaginatedServiceResult } from "@workspace/shared";

import { PERMISSION_AUDIT_LOG_READ } from "../../ports/authorization.tokens";
import type { PermissionAuditLogReadPort } from "../../ports/rbac-read.port";
import { ListPermissionAuditLogQuery } from "./list-permission-audit-log.query";

@QueryHandler(ListPermissionAuditLogQuery)
export class ListPermissionAuditLogHandler implements IQueryHandler<ListPermissionAuditLogQuery, PaginatedServiceResult<AuditLogEntry>> {
	public constructor(@Inject(PERMISSION_AUDIT_LOG_READ) private readonly auditLog: PermissionAuditLogReadPort) {}

	public async execute(query: ListPermissionAuditLogQuery): Promise<PaginatedServiceResult<AuditLogEntry>> {
		return this.auditLog.list(query.actor, query.query);
	}
}
