import { Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

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

import { ZodListQuery, ZodParams } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { CurrentUserId } from "../authorization/decorators/current-user.decorator";

import { HttpAuditLogQueryService } from "./services/http-audit-log-query.service";

/**
 * Admin viewer for the global HTTP audit trail (`audit_logs`, ADR 025): every
 * state-changing request and every sensitive read, with who / when / from
 * where / what was sent / what came back.
 *
 * Authorization: admin-panel access AND the `AUDIT_LOG` permission — `LIST`
 * for the table, `READ` for one complete record (payloads included). Admin,
 * Manager and SuperAdmin hold both. Every call is itself recorded as a
 * sensitive read. The controller only validates and delegates.
 */
@ApiTags("Audit Log")
@AdminAccessOnly("Admin access required to view the audit log.")
@Controller(apiPath("/admin/audit-logs"))
export class AuditLogsController {
	public constructor(private readonly auditLogs: HttpAuditLogQueryService) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@Get()
	@ApiOperation({ summary: "List audit records (newest first)", description: "Request metadata only — open one record for its redacted payloads." })
	@ZodPaginatedResponse(HttpAuditLogSummarySchema, { description: "Paginated audit records; pagination is in `meta`" })
	public async list(
		@CurrentUserId() actorId: string,
		@ZodListQuery(apiContract.auditLogs.list.input) query: HttpAuditLogListQuery,
		@Req() request: FastifyRequest,
	): Promise<PaginatedServiceResult<HttpAuditLogSummary>> {
		return this.auditLogs.list(actorId, query, request);
	}

	@RequirePermission("READ", "AUDIT_LOG")
	@Get(":id")
	@ApiOperation({ summary: "Get one complete audit record", description: "Includes the redacted request params, request body and response body." })
	@ZodResponse(HttpAuditLogDetailSchema, { description: "The complete audit record" })
	public async get(
		@CurrentUserId() actorId: string,
		@ZodParams(apiContract.auditLogs.detail.input) params: HttpAuditLogIdParam,
		@Req() request: FastifyRequest,
	): Promise<HttpAuditLogDetail> {
		return this.auditLogs.getById(actorId, params.id, request);
	}
}
