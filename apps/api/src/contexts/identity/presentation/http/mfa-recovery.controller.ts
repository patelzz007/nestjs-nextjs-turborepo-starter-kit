import { Controller, Get, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
	AdminMfaRecoveryListQuery,
	AdminMfaRecoveryRequest,
	AdminReviewMfaRecoveryInput,
	InitiateMfaRecoveryInput,
	MfaRecoveryStatusResponse,
	PaginatedServiceResult,
} from "@workspace/shared";
import { AdminMfaRecoveryRequestSchema, apiContract, apiPath, MfaRecoveryStatusResponseSchema } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Authorize, self } from "../../../../platform/presentation/http/security/decorators/authorize.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { RequestMfaRecoveryCommand } from "../../application/commands/request-mfa-recovery/request-mfa-recovery.command";
import { ReviewMfaRecoveryCommand } from "../../application/commands/review-mfa-recovery/review-mfa-recovery.command";
import { GetMyMfaRecoveryStatusQuery } from "../../application/queries/get-my-mfa-recovery-status/get-my-mfa-recovery-status.query";
import { ListMfaRecoveryRequestsQuery } from "../../application/queries/list-mfa-recovery-requests/list-mfa-recovery-requests.query";

/** Admin-reviewed MFA recovery: the member's request and status, and the SuperAdmin review queue. */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class MfaRecoveryController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.credential)
	@ApiBearerAuth()
	@Post("/mfa/recovery")
	@Authorize({ action: "UPDATE", resource: "USER", resourceId: self(), description: "User can initiate MFA recovery for their own account" })
	@ApiOperation({ summary: "Initiate an admin-reviewed MFA recovery request" })
	@ZodResponse(MfaRecoveryStatusResponseSchema, { description: "Recovery request status" })
	public async initiateRecovery(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.mfaRecoveryInitiate.input) body: InitiateMfaRecoveryInput,
		@CurrentActor() actor: ActorContext,
	): Promise<MfaRecoveryStatusResponse> {
		return this.commandBus.execute(new RequestMfaRecoveryCommand(actor, { userId, reason: body.reason }));
	}

	@ApiBearerAuth()
	@Get("/mfa/recovery/status")
	@ApiOperation({ summary: "Get the current MFA recovery request status" })
	@ZodResponse(MfaRecoveryStatusResponseSchema, { description: "Recovery request status" })
	public async getRecoveryStatus(@GetUser("sub") userId: string, @CurrentActor() actor: ActorContext): Promise<MfaRecoveryStatusResponse> {
		return this.queryBus.execute(new GetMyMfaRecoveryStatusQuery(actor, { userId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Get("/admin/mfa/recovery/requests")
	@ApiOperation({ summary: "SuperAdmin: list MFA recovery requests" })
	@ZodPaginatedResponse(AdminMfaRecoveryRequestSchema, { description: "Paginated MFA recovery requests" })
	public async listRecoveryRequests(
		@ZodListQuery(apiContract.auth.adminMfaRecoveryRequests.input) query: AdminMfaRecoveryListQuery,
		@CurrentActor() actor: ActorContext,
	): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		return this.queryBus.execute(new ListMfaRecoveryRequestsQuery(actor, { query }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@ApiBearerAuth()
	@SuperAdminOnly()
	@Post("/admin/mfa/recovery/review")
	@Authorize({
		action: "UPDATE",
		resource: "USER",
		description: "SuperAdmin can review MFA recovery requests",
	})
	@ApiOperation({ summary: "SuperAdmin: approve or deny an MFA recovery request" })
	@ZodResponse(MfaRecoveryStatusResponseSchema, { description: "Reviewed recovery request status" })
	public async reviewRecovery(
		@GetUser("sub") adminUserId: string,
		@ZodBody(apiContract.auth.adminMfaRecoveryReview.input) body: AdminReviewMfaRecoveryInput,
		@CurrentActor() actor: ActorContext,
	): Promise<MfaRecoveryStatusResponse> {
		return this.commandBus.execute(new ReviewMfaRecoveryCommand(actor, { reviewerId: adminUserId, requestId: body.requestId, decision: body.action, notes: body.notes }));
	}
}
