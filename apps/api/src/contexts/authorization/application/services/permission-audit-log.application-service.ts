import { Inject, Injectable } from "@nestjs/common";
import type { AuditLogEntry, AuditLogQueryInput, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { PERMISSION_AUDIT_LOG_READ } from "../ports/authorization.tokens";
import type { PermissionAuditLogReadPort } from "../ports/rbac-read.port";

/** The RBAC change history: every role, permission and assignment change, with who made it (ADR 096). */
@Injectable()
export class PermissionAuditLogApplicationService {
	public constructor(@Inject(PERMISSION_AUDIT_LOG_READ) private readonly auditLog: PermissionAuditLogReadPort) {}

	public list(actor: ActorContext, query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		return this.auditLog.list(actor, query);
	}
}
