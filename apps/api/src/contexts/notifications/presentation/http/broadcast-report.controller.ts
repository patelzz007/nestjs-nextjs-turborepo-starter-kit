// ============================================
// notifications/presentation/http/broadcast-report.controller.ts — a recipient reports a broadcast (ADR 073)
// ============================================
import { Controller, HttpStatus, Inject, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	BroadcastIdParamsSchema,
	OkResponseSchema,
	ReportBroadcastSchema,
	type BroadcastIdParams,
	type OkResponse,
	type ReportBroadcastInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { self } from "../../../../platform/presentation/http/security/decorators/permission-target";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { BROADCAST_SERVICE } from "../../application/ports/notifications.tokens";
import type { BroadcastService } from "../../application/services/broadcast-service";

/** A recipient reports a broadcast they received (spam, offensive, a scam). */
@ApiTags("Broadcasts")
@ApiBearerAuth()
@Controller(apiPath("/broadcasts"))
export class BroadcastReportController {
	public constructor(@Inject(BROADCAST_SERVICE) private readonly broadcasts: BroadcastService) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "PROFILE", { resourceId: self(), description: "A person reports a broadcast they received" })
	@Post(":broadcastId/report")
	@ApiOperation({ summary: "Report a broadcast from your inbox (once per broadcast); 404 for one you did not receive" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Reported" })
	public async report(
		@CurrentActor() actor: ActorContext,
		@ZodParams(BroadcastIdParamsSchema) params: BroadcastIdParams,
		@ZodBody(ReportBroadcastSchema) input: ReportBroadcastInput,
	): Promise<OkResponse> {
		await this.broadcasts.report(actor, params.broadcastId, input);
		return { ok: true };
	}
}
