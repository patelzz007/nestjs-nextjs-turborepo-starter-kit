import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { apiContract, apiPath } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
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
	@ApiOkResponse({ description: "Paginated marketplace rewards" })
	public listRewards(
		@Query(new ZodValidationPipe(apiContract.rewards.list.input)) query: Parameters<ConsumerRewardsService["listMarketplace"]>[0],
	): ReturnType<ConsumerRewardsService["listMarketplace"]> {
		return this.consumerRewardsService.listMarketplace(query);
	}

	@Public()
	@RlsBypass()
	@Get(":rewardId")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get published reward detail" })
	@ApiOkResponse({ description: "Reward detail" })
	public getReward(@Param(new ZodValidationPipe(apiContract.rewards.detail.input)) params: { rewardId: string }): ReturnType<ConsumerRewardsService["getPublishedReward"]> {
		return this.consumerRewardsService.getPublishedReward(params.rewardId);
	}
}
