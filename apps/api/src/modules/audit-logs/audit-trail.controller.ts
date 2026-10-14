import { Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import { apiContract, apiPath, AuditTrailEntrySchema, type AuditTrailEntry, type AuditTrailListQuery, type PaginatedServiceResult } from "@workspace/shared";

import { ZodListQuery } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { CurrentUserId } from "../authorization/decorators/current-user.decorator";

import { AuditTrailQueryService } from "./services/audit-trail-query.service";

/**
 * The admin audit log's timeline (ADR 051): every HTTP request — with the rows
 * it changed — and every database write no request made, newest first. The
 * complete records stay at `GET /admin/audit-logs/:id` and
 * `GET /admin/data-changes/:id`.
 *
 * Authorization: admin-panel access AND `LIST AUDIT_LOG`. Every call is itself
 * recorded as a sensitive read. The controller only validates and delegates.
 */
@ApiTags("Audit Log")
@AdminAccessOnly("Admin access required to view the audit log.")
@Controller(apiPath("/admin/audit-trail"))
export class AuditTrailController {
	public constructor(private readonly auditTrail: AuditTrailQueryService) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@Get()
	@ApiOperation({
		summary: "List the audit trail (newest first)",
		description: "HTTP requests (with how many rows each changed) and background database writes as one timeline.",
	})
	@ZodPaginatedResponse(AuditTrailEntrySchema, { description: "Paginated timeline entries; pagination is in `meta`" })
	public async list(
		@CurrentUserId() actorId: string,
		@ZodListQuery(apiContract.auditTrail.list.input) query: AuditTrailListQuery,
		@Req() request: FastifyRequest,
	): Promise<PaginatedServiceResult<AuditTrailEntry>> {
		return this.auditTrail.list(actorId, query, request);
	}
}
