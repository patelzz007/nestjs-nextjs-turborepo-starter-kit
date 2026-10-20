import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import { apiPath, AuditLogEntrySchema, AuditLogQuerySchema, type AuditLogEntry, type AuditLogQueryInput, type PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ListPermissionAuditLogQuery } from "../../application/queries/list-permission-audit-log/list-permission-audit-log.query";
import { AUDIT_LOG_READ_OPERATION } from "../../application/ports/authorization.tokens";

/** Query authorization audit logs (`AUDIT_LOG:READ`). */
@Controller(apiPath("/admin/audit"))
@ApiTags("Audit Log")
export class AuditController {
	public constructor(private readonly queryBus: QueryBus) {}

	@Get()
	@PlatformOperation(AUDIT_LOG_READ_OPERATION)
	@RequirePermission("READ", "AUDIT_LOG")
	@ZodPaginatedResponse(AuditLogEntrySchema, { description: "Paginated audit log entries (newest first); pagination is in `meta`" })
	public async list(@CurrentActor() actor: ActorContext, @ZodListQuery(AuditLogQuerySchema) query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>> {
		return this.queryBus.execute(new ListPermissionAuditLogQuery(actor, query));
	}
}
