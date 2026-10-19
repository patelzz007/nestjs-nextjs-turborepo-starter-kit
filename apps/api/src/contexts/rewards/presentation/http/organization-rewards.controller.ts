import { Controller, Get, HttpStatus, Patch, Post, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
	apiContract,
	apiPath,
	MerchantCreateRewardSchema,
	MerchantRewardListQuerySchema,
	MerchantRewardSummaryQuerySchema,
	MerchantRewardSummarySchema,
	MerchantUpdateRewardSchema,
	OrganizationSlugParamSchema,
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
import { GetOrganizationRewardQuery } from "../../application/queries/get-organization-reward/get-organization-reward.query";
import { ListOrganizationRewardsQuery } from "../../application/queries/list-organization-rewards/list-organization-rewards.query";
import { SummarizeOrganizationRewardsQuery } from "../../application/queries/summarize-organization-rewards/summarize-organization-rewards.query";
import { RewardsEmptyBodyDto } from "./rewards-empty-body.dto";

@ApiTags("Organization Rewards")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/rewards"))
export class OrganizationRewardsController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization rewards" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "One page of the organization's rewards; pagination is in `meta`" })
	public listRewards(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodListQuery(MerchantRewardListQuerySchema) query: MerchantRewardListQuery,
	): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.queryBus.execute(new ListOrganizationRewardsQuery(actor, { ...query, organizationId: merchant.organizationId }));
	}

	@SkipAuthThrottle()
	@Get("summary")
	@ApiOperation({ summary: "Organization reward figures: the count in each status and the units still claimable, over every reward in the store scope" })
	@ZodResponse(MerchantRewardSummarySchema, { description: "Reward catalog figures" })
	public summarizeRewards(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodQuery(MerchantRewardSummaryQuerySchema) query: MerchantRewardSummaryQuery,
	): Promise<MerchantRewardSummary> {
		return this.queryBus.execute(new SummarizeOrganizationRewardsQuery(actor, { ...query, organizationId: merchant.organizationId }));
	}

	@SkipAuthThrottle()
	@Get(":rewardId")
	@ApiOperation({ summary: "Read one organization reward (404 when not offered at any of the caller's stores)" })
	@ZodResponse(RewardResponseSchema, { description: "Reward" })
	public getReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.organizations.rewards.get.input) params: z.output<typeof apiContract.organizations.rewards.get.input>,
	): Promise<RewardResponse> {
		return this.queryBus.execute(new GetOrganizationRewardQuery(actor, { organizationId: merchant.organizationId, rewardId: params.rewardId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post()
	@ApiOperation({ summary: "Create a draft reward" })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Created reward" })
	public createReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodBody(MerchantCreateRewardSchema) body: z.output<typeof MerchantCreateRewardSchema>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new CreateRewardCommand(actor, { ...body, organizationId: merchant.organizationId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Patch(":rewardId")
	@ApiOperation({ summary: "Update a draft or pending reward" })
	@ZodResponse(RewardResponseSchema, { description: "Updated reward" })
	public updateReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(z.object({ orgSlug: OrganizationSlugParamSchema.shape.orgSlug, rewardId: UuidParamSchema }).strict())
		params: { orgSlug: string; rewardId: string },
		@ZodBody(MerchantUpdateRewardSchema) body: z.output<typeof MerchantUpdateRewardSchema>,
	): Promise<RewardResponse> {
		return this.commandBus.execute(new ReviseRewardCommand(actor, { ...body, organizationId: merchant.organizationId, rewardId: params.rewardId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post(":rewardId/publish")
	@ApiOperation({ summary: "Submit reward for moderation review (no body required)" })
	@ApiBody({ type: RewardsEmptyBodyDto, required: false })
	@ZodResponse(RewardResponseSchema, { status: HttpStatus.CREATED, description: "Reward pending review" })
	public publishReward(
		@GetMerchantActor() merchant: MerchantActor,
		@CurrentActor() actor: ActorContext,
		@ZodParams(apiContract.organizations.rewards.publish.input) params: { orgSlug: string; rewardId: string },
	): Promise<RewardResponse> {
		return this.commandBus.execute(new SubmitRewardForReviewCommand(actor, { organizationId: merchant.organizationId, rewardId: params.rewardId }));
	}
}
