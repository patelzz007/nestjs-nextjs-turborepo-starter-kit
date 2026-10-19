import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

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

import { ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetDataChangeQuery } from "../../application/queries/get-data-change/get-data-change.query";
import { ListDataChangesQuery } from "../../application/queries/list-data-changes/list-data-changes.query";

/**
 * Admin viewer for the row-level data-change trail (`DataChangeLog`,
 * ADR 051): every INSERT / UPDATE / DELETE / TRUNCATE on a captured table,
 * whoever or whatever made it, with the redacted row before and after.
 *
 * Authorization: the same as the HTTP audit viewer — admin-panel access AND
 * the `AUDIT_LOG` permission (`LIST` for the table, `READ` for one complete
 * record with its row images). Every call is itself recorded as a sensitive
 * read. The controller only validates and dispatches one query.
 */
@ApiTags("Audit Log")
@AdminAccessOnly("Admin access required to view the data-change trail.")
@Controller(apiPath("/admin/data-changes"))
export class DataChangesController {
	public constructor(private readonly queryBus: QueryBus) {}

	@RequirePermission("LIST", "AUDIT_LOG")
	@Get()
	@ApiOperation({ summary: "List row changes (newest first)", description: "Change metadata only — open one record for the redacted row before and after." })
	@ZodPaginatedResponse(DataChangeLogSummarySchema, { description: "Paginated row-change records; pagination is in `meta`" })
	public async list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.dataChanges.list.input) query: DataChangeLogListQuery,
	): Promise<PaginatedServiceResult<DataChangeLogSummary>> {
		return this.queryBus.execute(new ListDataChangesQuery(actor, query));
	}

	@RequirePermission("READ", "AUDIT_LOG")
	@Get(":id")
	@ApiOperation({ summary: "Get one complete row-change record", description: "Includes the redacted row images before and after the change." })
	@ZodResponse(DataChangeLogDetailSchema, { description: "The complete row-change record" })
	public async get(@CurrentActor() actor: ActorContext, @ZodParams(apiContract.dataChanges.detail.input) params: DataChangeLogIdParam): Promise<DataChangeLogDetail> {
		return this.queryBus.execute(new GetDataChangeQuery(actor, params));
	}
}
