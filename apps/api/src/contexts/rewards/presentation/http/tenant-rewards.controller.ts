import { Controller, Get, HttpStatus, Patch, Post, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
	apiContract,
	apiPath,
	MerchantCreateRewardSchema,
	MerchantRewardListQuerySchema,
	MerchantRewardSummaryQuerySchema,
	MerchantRewardSummarySchema,
	MerchantUpdateRewardSchema,
	TenantSlugParamSchema,
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

/**
 * The tenant's reward catalog, for signed-in members (`:tenantSlug`). An integration API key uses
 * `/integration/rewards` instead: a machine credential names no tenant (D6).
 */
@ApiTags("Tenant Rewards")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/rewards"))
export class TenantRewardsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List tenant rewards" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "One page of the tenant's rewards; pagination is in `meta`" })
	public listRewards(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(MerchantRewardListQuerySchema) query: MerchantRewardListQuery,
	): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.queryBus.execute(new ListTenantRewardsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get("summary")
	@ApiOperation({ summary: "Tenant reward figures: the count in each status and the units still claimable, over every reward in the store scope" })
	@ZodResponse(MerchantRewardSummarySchema, { description: "Reward catalog figures" })
	public summarizeRewards(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodQuery(MerchantRewardSummaryQuerySchema) query: MerchantRewardSummaryQuery,
	): Promise<MerchantRewardSummary> {
		return this.queryBus.execute(new SummarizeTenantRewardsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}

	@SkipAuthThrottle()
	@Get(":rewardId")
	@ApiOperation({ summary: "Read one tenant reward (404 when not offered at any of the caller's stores)" })
	@ZodResponse(RewardResponseSchema, { description: "Reward" })
	public getReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.tenants.rewards.get.input) params: z.output<typeof apiContract.tenants.rewards.get.input>,
	): Promise<RewardResponse> {
		return this.queryBus.execute(new GetTenantRewardQuery(actor, { tenantId: merchant.tenantId, rewardId: params.rewardId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@ApiOperation({ summary: "Create a draft reward" })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Created reward" })
	public createReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodBody(MerchantCreateRewardSchema) body: z.output<typeof MerchantCreateRewardSchema>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new CreateRewardCommand(actor, { ...body, tenantId: merchant.tenantId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":rewardId")
	@ApiOperation({ summary: "Update a draft or pending reward" })
	@ZodResponse(RewardResponseSchema, { description: "Updated reward" })
	public updateReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(z.object({ tenantSlug: TenantSlugParamSchema.shape.tenantSlug, rewardId: UuidParamSchema }).strict())
		params: { tenantSlug: string; rewardId: string },
		@ZodBody(MerchantUpdateRewardSchema) body: z.output<typeof MerchantUpdateRewardSchema>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new ReviseRewardCommand(actor, { ...body, tenantId: merchant.tenantId, rewardId: params.rewardId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":rewardId/publish")
	@ApiOperation({ summary: "Submit reward for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Reward pending review" })
	public publishReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.tenants.rewards.publish.input) params: { tenantSlug: string; rewardId: string },
	): Promise<RewardResponse> {
		return this.commandBus.execute(new SubmitRewardForReviewCommand(actor, { tenantId: merchant.tenantId, rewardId: params.rewardId }));
	}
}
