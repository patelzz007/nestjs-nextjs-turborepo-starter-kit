import { Get, HttpStatus, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";
import { apiContract, OkResponseSchema, RewardClaimCheckoutStatusSchema, type OkResponse, type RewardClaimCheckoutStatus } from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AcceptLegalTermsCommand } from "../../application/commands/accept-legal-terms/accept-legal-terms.command";
import { LegalAcceptanceApplicationService } from "../../application/services/legal-acceptance.application-service";

@ApiTags("Legal")
@ApiBearerAuth()
@ApiController("/legal")
export class RewardLegalController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly legal: LegalAcceptanceApplicationService,
	) {}

	@Get("status")
	@ApiOperation({ summary: "Get rewards legal acceptance and verified phone status" })
	@ZodResponse(RewardClaimCheckoutStatusSchema, { description: "Claim checkout status for the signed-in user" })
	public getStatus(@CurrentActor() actor: ActorContext): Promise<RewardClaimCheckoutStatus> {
		return this.legal.checkoutStatus(actor);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("accept")
	@ApiOperation({ summary: "Accept rewards terms and privacy policy" })
	@ZodResponse(OkResponseSchema, { status: HttpStatus.CREATED, description: "Legal acceptance recorded" })
	public acceptLegal(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.legal.accept.input) body: z.output<typeof apiContract.legal.accept.input>,
	): Promise<OkResponse> {
		return this.commandBus.execute(new AcceptLegalTermsCommand(actor, body));
	}
}
