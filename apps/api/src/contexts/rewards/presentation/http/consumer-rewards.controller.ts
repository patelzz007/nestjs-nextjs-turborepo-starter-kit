import { Controller, Get, Header } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";
import { apiContract, apiPath, RewardResponseSchema, type PaginatedServiceResult, type RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { MARKETPLACE_REWARDS_READ_OPERATION } from "../../application/ports/rewards.tokens";
import { GetPublishedRewardQuery } from "../../application/queries/get-published-reward/get-published-reward.query";
import { ListMarketplaceRewardsQuery } from "../../application/queries/list-marketplace-rewards/list-marketplace-rewards.query";

/** A public route's caller may be signed out. */
const PUBLIC_ACTOR = { allowAnonymous: true };

@ApiTags("Rewards")
@Controller(apiPath("/rewards"))
export class ConsumerRewardsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@Public()
	@PublicOperation(MARKETPLACE_REWARDS_READ_OPERATION)
	@Get()
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Browse published consumer rewards" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "Paginated marketplace rewards" })
	public listRewards(
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
		@ZodListQuery(apiContract.rewards.list.input) query: z.output<typeof apiContract.rewards.list.input>,
	): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.queryBus.execute(new ListMarketplaceRewardsQuery(actor, query));
	}

	@Public()
	@PublicOperation(MARKETPLACE_REWARDS_READ_OPERATION)
	@Get(":rewardId")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get published reward detail" })
	@ZodResponse(RewardResponseSchema, { description: "Reward detail" })
	public getReward(@CurrentActor(PUBLIC_ACTOR) actor: ActorContext, @ZodParams(apiContract.rewards.detail.input) params: { rewardId: string }): Promise<RewardResponse> {
		return this.queryBus.execute(new GetPublishedRewardQuery(actor, params));
	}
}
