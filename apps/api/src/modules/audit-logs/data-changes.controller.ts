import { Controller, Get, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import {
	apiContract,
	apiPath,
	DataChangeLogDetailSchema,
	DataChangeLogSummarySchema,
	type DataChangeLogDetail,
	type DataChangeLogIdParam,
	type DataChangeLogListQuery,
	type DataChangeLogSummary,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { ZodListQuery, ZodParams } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../auth/decorators/admin-access.decorator";
import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { CurrentUserId } from "../authorization/decorators/current-user.decorator";

import { DataChangeLogQueryService } from "./services/data-change-log-query.service";

/**
 * Admin viewer for the row-level data-change trail (`data_change_logs`,
 * ADR 051): every INSERT / UPDATE / DELETE / TRUNCATE on a captured table,
 * whoever or whatever made it, with the redacted row before and after.
 *
 * Authorization: the same as the HTTP audit viewer — admin-panel access AND
 * the `AUDIT_LOG` permission (`LIST` for the table, `READ` for one complete
 * record with its row images). Every call is itself recorded as a sensitive
 * read. The controller only validates and delegates.
 */
@ApiTags("Audit Log")
@AdminAccessOnly("Admin access required to view the data-change trail.")
@Controller(apiPath("/admin/data-changes"))
export class DataChangesController {
	public constructor(private readonly dataChanges: DataChangeLogQueryService) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@Get()
	@ApiOperation({ summary: "List row changes (newest first)", description: "Change metadata only — open one record for the redacted row before and after." })
	@ZodPaginatedResponse(DataChangeLogSummarySchema, { description: "Paginated row-change records; pagination is in `meta`" })
	public async list(
		@CurrentUserId() actorId: string,
		@ZodListQuery(apiContract.dataChanges.list.input) query: DataChangeLogListQuery,
		@Req() request: FastifyRequest,
	): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		return this.dataChanges.list(actorId, query, request);
	}

	@RequirePermission("READ", "AUDIT_LOG")
	@Get(":id")
	@ApiOperation({ summary: "Get one complete row-change record", description: "Includes the redacted row images before and after the change." })
	@ZodResponse(DataChangeLogDetailSchema, { description: "The complete row-change record" })
	public async get(
		@CurrentUserId() actorId: string,
		@ZodParams(apiContract.dataChanges.detail.input) params: DataChangeLogIdParam,
		@Req() request: FastifyRequest,
	): Promise<DataChangeLogDetail> {
		return this.dataChanges.getById(actorId, params.id, request);
	}
}
