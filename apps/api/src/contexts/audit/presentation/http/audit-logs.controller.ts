import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	apiContract,
	apiPath,
	HttpAuditLogDetailSchema,
	HttpAuditLogSummarySchema,
	type HttpAuditLogDetail,
	type HttpAuditLogIdParam,
	type HttpAuditLogListQuery,
	type HttpAuditLogSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetHttpAuditLogQuery } from "../../application/queries/get-http-audit-log/get-http-audit-log.query";
import { ListHttpAuditLogsQuery } from "../../application/queries/list-http-audit-logs/list-http-audit-logs.query";

/**
 * Admin viewer for the global HTTP audit trail (`AuditLog`, ADR 025): every
 * state-changing request and every sensitive read, with who / when / from
 * where / what was sent / what came back.
 *
 * Authorization: admin-panel access AND the `AUDIT_LOG` permission — `LIST`
 * for the table, `READ` for one complete record (payloads included). Admin,
 * Manager and SuperAdmin hold both. Every call is itself recorded as a
 * sensitive read. The controller only validates and dispatches one query.
 */
@ApiTags("Audit Log")
@AdminAccessOnly("Admin access required to view the audit log.")
@Controller(apiPath("/admin/audit-logs"))
export class AuditLogsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@Get()
	@ApiOperation({ summary: "List audit records (newest first)", description: "Request metadata only — open one record for its redacted payloads." })
	@ZodPaginatedResponse(HttpAuditLogSummarySchema, { description: "Paginated audit records; pagination is in `meta`" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.auditLogs.list.input) query: HttpAuditLogListQuery,
	): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		return this.queryBus.execute(new ListHttpAuditLogsQuery(actor, query));
	}

	@RequirePermission("READ", "AUDIT_LOG")
	@Get(":id")
	@ApiOperation({ summary: "Get one complete audit record", description: "Includes the redacted request params, request body and response body." })
	@ZodResponse(HttpAuditLogDetailSchema, { description: "The complete audit record" })
	public async get(@CurrentActor() actor: ActorContext, @ZodParams(apiContract.auditLogs.detail.input) params: HttpAuditLogIdParam): Promise<HttpAuditLogDetail> {
		return this.queryBus.execute(new GetHttpAuditLogQuery(actor, params));
	}
}
