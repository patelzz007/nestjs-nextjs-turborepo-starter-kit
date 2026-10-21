import { Controller, HttpStatus, Inject, Post } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	RewardReferralAttributionResponseSchema,
	RewardReferralAttributionSchema,
	RewardReferralLinkResponseSchema,
	UuidParamSchema,
	type RewardReferralAttributionInput,
	type RewardReferralAttributionResponse,
	type RewardReferralLinkResponse,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CreateRewardReferralLinkCommand } from "../../application/commands/create-reward-referral-link/create-reward-referral-link.command";
import { RecordRewardReferralAttributionCommand } from "../../application/commands/record-reward-referral-attribution/record-reward-referral-attribution.command";
import { CREATE_REWARD_REFERRAL_LINK_OPERATION, RECORD_REWARD_REFERRAL_ATTRIBUTION_OPERATION } from "../../application/ports/referrals.tokens";

/** The one call each route makes of the command bus. */
export interface RewardReferralCommandDispatch {
	execute<TResult>(command: CreateRewardReferralLinkCommand | RecordRewardReferralAttributionCommand): Promise<TResult>;
}

const RewardParamsSchema = z.object({ rewardId: UuidParamSchema }).strict();

/** Reward referral links: a signed-in consumer shares a reward, and the friend who opens the link is remembered for their claim. */
@ApiTags("Referrals")
@ApiBearerAuth()
@Controller(apiPath("/referrals"))
export class RewardReferralController {
	public constructor(@Inject(CommandBus) private readonly commandBus: RewardReferralCommandDispatch) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("rewards/:rewardId/links")
	@PlatformOperation(CREATE_REWARD_REFERRAL_LINK_OPERATION)
	@ApiOperation({
		summary: "Mint a share link for a reward",
		description:
			"Each link credits one friend. 404 REFERRAL_REWARD_NOT_REFERABLE when the reward cannot be shared; 409 REFERRAL_LINK_LIMIT_REACHED at the cap of unused links.",
	})
	@ZodResponse(RewardReferralLinkResponseSchema, { status: HttpStatus.CREATED, description: "The new link's attribution token" })
	public async createLink(
		@CurrentActor() actor: ActorContext,
		@ZodParams(RewardParamsSchema) params: z.output<typeof RewardParamsSchema>,
	): Promise<RewardReferralLinkResponse> {
		return this.commandBus.execute(new CreateRewardReferralLinkCommand(actor, params.rewardId));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("attribution")
	@PlatformOperation(RECORD_REWARD_REFERRAL_ATTRIBUTION_OPERATION)
	@ApiOperation({
		summary: "Remember the referral link the caller opened",
		description: "The next claim of that reward within the window is credited to the referrer. 404 REFERRAL_LINK_INVALID; 409 REFERRAL_OWN_LINK.",
	})
	@ZodResponse(RewardReferralAttributionResponseSchema, { status: HttpStatus.CREATED, description: "The pending attribution" })
	public async recordAttribution(
		@CurrentActor() actor: ActorContext,
		@ZodBody(RewardReferralAttributionSchema) body: RewardReferralAttributionInput,
	): Promise<RewardReferralAttributionResponse> {
		return this.commandBus.execute(new RecordRewardReferralAttributionCommand(actor, body.attributionToken));
	}
}
