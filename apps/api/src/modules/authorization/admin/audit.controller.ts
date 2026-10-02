import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { apiPath, AuditLogEntrySchema, AuditLogQuerySchema, type AuditLogEntry, type AuditLogQueryInput, type PaginatedServiceResult } from "@workspace/shared";

import { ZodListQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../common/decorators/zod-response.decorators";
import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { PermissionAuditLogQueryService } from "./services/permission-audit-log-query.service";

/**
 * Query authorization audit logs.
 *
 * All queries require `AUDIT_LOG:READ` permission. The controller only
 * validates and delegates — the query lives in `PermissionAuditLogRepository`.
 */
@Controller(apiPath("/admin/audit"))
@ApiTags("Audit Log")
export class AuditController {
	public constructor(private readonly auditLogs: PermissionAuditLogQueryService) {}

	@Get()
	@RequirePermission("READ", "AUDIT_LOG")
	@ZodPaginatedResponse(AuditLogEntrySchema, { description: "Paginated audit log entries (newest first); pagination is in `meta`" })
	public async list(@ZodListQuery(AuditLogQuerySchema) query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		return this.auditLogs.list(query);
	}
}
