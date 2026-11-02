// ============================================
// notifications/presentation/http/broadcast-reports-admin.controller.ts — reports staff decide on (ADR 073)
// ============================================
import { Controller, Get, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	BroadcastReportEntrySchema,
	BroadcastReportListQuerySchema,
	OkResponseSchema,
	ReviewBroadcastReportSchema,
	type BroadcastReportEntry,
	type BroadcastReportListQuery,
	type OkResponse,
	type PaginatedServiceResult,
	type ReviewBroadcastReportInput,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { BROADCAST_SERVICE } from "../../application/ports/notifications.tokens";
import { BROADCASTS_REPORTS_OPERATION, type BroadcastService } from "../../application/services/broadcast-service";

const ReportIdParamsSchema = z.object({ reportId: z.uuid() }).strict();

/** Platform staff: the reports recipients send, and the decision on each. */
@ApiTags("Broadcasts")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for broadcast reports.")
@Controller(apiPath("/admin/broadcast-reports"))
export class BroadcastReportsAdminController {
	public constructor(@Inject(BROADCAST_SERVICE) private readonly broadcasts: BroadcastService) {}

	@RequirePermission("LIST", "BROADCAST_REPORT")
	@PlatformOperation(BROADCASTS_REPORTS_OPERATION)
	@Get()
	@ApiOperation({ summary: "Reports from recipients, newest first, with the tenant's strikes in the last 90 days" })
	@ZodPaginatedResponse(BroadcastReportEntrySchema, { description: "One page of reports" })
	public list(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(BroadcastReportListQuerySchema) query: BroadcastReportListQuery,
	): Promise<PaginatedServiceResult<BroadcastReportEntry>> {
		return this.broadcasts.listReports(actor, query);
	}

	@RateLimit(RATE_LIMIT_POLICY.adminSecurityMutation)
	@RequirePermission("UPDATE", "BROADCAST_REPORT")
	@PlatformOperation(BROADCASTS_REPORTS_OPERATION)
	@Post(":reportId/review")
	@ApiOperation({ summary: "Dismiss (resume), uphold (stop it, strike the tenant; three strikes in 90 days stop its broadcasting) or resume" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Decided" })
	public async review(
		@CurrentActor() actor: ActorContext,
		@ZodParams(ReportIdParamsSchema) params: z.output<typeof ReportIdParamsSchema>,
		@ZodBody(ReviewBroadcastReportSchema) input: ReviewBroadcastReportInput,
	): Promise<OkResponse> {
		await this.broadcasts.reviewReport(actor, params.reportId, input);
		return { ok: true };
	}
}
