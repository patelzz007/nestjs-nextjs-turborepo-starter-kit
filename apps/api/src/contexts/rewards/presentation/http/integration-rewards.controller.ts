import { Controller, Get, HttpStatus, Patch, Post, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBody, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
	apiContract,
	apiPath,
	MerchantCreateRewardSchema,
	MerchantRewardListQuerySchema,
	MerchantRewardSummaryQuerySchema,
	MerchantRewardSummarySchema,
	MerchantUpdateRewardSchema,
	RewardResponseSchema,
	UuidParamSchema,
	type MerchantRewardListQuery,
	type MerchantRewardSummary,
	type MerchantRewardSummaryQuery,
	type PaginatedServiceResult,
	type RewardResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AllowApiKeyAuth } from "../../../../platform/presentation/http/security/decorators/allow-api-key-auth.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CreateRewardCommand } from "../../application/commands/create-reward/create-reward.command";
import { ReviseRewardCommand } from "../../application/commands/revise-reward/revise-reward.command";
import { SubmitRewardForReviewCommand } from "../../application/commands/submit-reward-for-review/submit-reward-for-review.command";
import { GetTenantRewardQuery } from "../../application/queries/get-tenant-reward/get-tenant-reward.query";
import { ListTenantRewardsQuery } from "../../application/queries/list-tenant-rewards/list-tenant-rewards.query";
import { SummarizeTenantRewardsQuery } from "../../application/queries/summarize-tenant-rewards/summarize-tenant-rewards.query";
import { RewardsEmptyBodyDto } from "./rewards-empty-body.dto";

const RewardIdParamsSchema = z.object({ rewardId: UuidParamSchema }).strict();

/**
 * An integration API key's own reward catalog (D6): the key names no tenant — its tenant and store come
 * from the key, so the path carries no `:tenantSlug`. The same operations as
 * `/tenants/:tenantSlug/rewards`, which serves signed-in members; a user here has no tenant and gets 401.
 */
@ApiTags("Integration")
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/integration/rewards"))
export class IntegrationRewardsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List the API key's tenant rewards" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "One page of the tenant's rewards; pagination is in `meta`" })
	public listRewards(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(MerchantRewardListQuerySchema) query: MerchantRewardListQuery,
	): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.queryBus.execute(new ListTenantRewardsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get("summary")
	@ApiOperation({ summary: "The API key's tenant reward figures: the count in each status and the units still claimable" })
	@ZodResponse(MerchantRewardSummarySchema, { description: "Reward catalog figures" })
	public summarizeRewards(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodQuery(MerchantRewardSummaryQuerySchema) query: MerchantRewardSummaryQuery,
	): Promise<MerchantRewardSummary> {
		return this.queryBus.execute(new SummarizeTenantRewardsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get(":rewardId")
	@ApiOperation({ summary: "Read one of the API key's tenant rewards (404 when not offered at the key's store)" })
	@ZodResponse(RewardResponseSchema, { description: "Reward" })
	public getReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.integration.rewards.get.input) params: z.output<typeof apiContract.integration.rewards.get.input>,
	): Promise<RewardResponse> {
		return this.queryBus.execute(new GetTenantRewardQuery(actor, { tenantId: merchant.tenantId, rewardId: params.rewardId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@ApiOperation({ summary: "Create a draft reward for the API key's tenant" })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Created reward" })
	public createReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodBody(MerchantCreateRewardSchema) body: z.output<typeof MerchantCreateRewardSchema>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new CreateRewardCommand(actor, { ...body, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":rewardId")
	@ApiOperation({ summary: "Update a draft or pending reward of the API key's tenant" })
	@ZodResponse(RewardResponseSchema, { description: "Updated reward" })
	public updateReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(RewardIdParamsSchema) params: z.output<typeof RewardIdParamsSchema>,
		@ZodBody(MerchantUpdateRewardSchema) body: z.output<typeof MerchantUpdateRewardSchema>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new ReviseRewardCommand(actor, { ...body, tenantId: merchant.tenantId, rewardId: params.rewardId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":rewardId/publish")
	@ApiOperation({ summary: "Submit one of the API key's tenant rewards for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Reward pending review" })
	public publishReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.integration.rewards.publish.input) params: z.output<typeof apiContract.integration.rewards.publish.input>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new SubmitRewardForReviewCommand(actor, { tenantId: merchant.tenantId, rewardId: params.rewardId }));
	}
}
