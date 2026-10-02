import { Controller, Get, Header } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import { apiContract, apiPath, RewardResponseSchema } from "@workspace/shared";
import { ZodListQuery, ZodParams } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";

import { ConsumerRewardsService } from "../services/consumer-rewards.service";

@ApiTags("Rewards")
@Controller(apiPath("/rewards"))
export class ConsumerRewardsController {
	public constructor(private readonly consumerRewardsService: ConsumerRewardsService) {}

	@Public()
	@RlsBypass()
	@Get()
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Browse published consumer rewards" })
	@ZodPaginatedResponse(RewardResponseSchema, { description: "Paginated marketplace rewards" })
	public listRewards(
		@ZodListQuery(apiContract.rewards.list.input) query: z.output<typeof apiContract.rewards.list.input>,
	): ReturnType<ConsumerRewardsService["listMarketplace"]> {
		return this.consumerRewardsService.listMarketplace(query);
	}

	@Public()
	@RlsBypass()
	@Get(":rewardId")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get published reward detail" })
	@ZodResponse(RewardResponseSchema, { description: "Reward detail" })
	public getReward(@ZodParams(apiContract.rewards.detail.input) params: { rewardId: string }): ReturnType<ConsumerRewardsService["getPublishedReward"]> {
		return this.consumerRewardsService.getPublishedReward(params.rewardId);
	}
}
