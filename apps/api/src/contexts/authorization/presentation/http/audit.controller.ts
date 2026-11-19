import { Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuditLogEntrySchema, AuditLogQuerySchema, type AuditLogEntry, type AuditLogQueryInput, type PaginatedServiceResult } from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { PermissionAuditLogApplicationService } from "../../application/services/permission-audit-log.application-service";
import { AUDIT_LOG_READ_OPERATION } from "../../application/ports/authorization.tokens";

/** Query authorization audit logs (`AUDIT_LOG:READ`). */
@ApiController("/admin/audit")
@ApiTags("Audit Log")
export class AuditController {
	public constructor(private readonly auditLog: PermissionAuditLogApplicationService) {}

	@Get()
	@PlatformOperation(AUDIT_LOG_READ_OPERATION)
	@RequirePermission("READ", "AUDIT_LOG")
	@ZodPaginatedResponse(AuditLogEntrySchema, { description: "Paginated audit log entries (newest first); pagination is in `meta`" })
	public async list(@CurrentActor() actor: ActorContext, @ZodListQuery(AuditLogQuerySchema) query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		return this.auditLog.list(actor, query);
	}
}
