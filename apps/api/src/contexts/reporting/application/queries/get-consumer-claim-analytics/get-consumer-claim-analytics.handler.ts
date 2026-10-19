import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { UserRewardsAnalyticsResponse } from "@workspace/shared";

import { WeeklyAnalyticsAssembler } from "../../assemblers/weekly-analytics.assembler";
import { requireCustomer } from "../../assemblers/analytics-actor";
import { GetConsumerClaimAnalyticsQuery } from "./get-consumer-claim-analytics.query";

@Injectable()
@QueryHandler(GetConsumerClaimAnalyticsQuery)
export class GetConsumerClaimAnalyticsHandler implements IQueryHandler<GetConsumerClaimAnalyticsQuery, UserRewardsAnalyticsResponse> {
	public constructor(private readonly weekly: WeeklyAnalyticsAssembler) {}

	public async execute(query: GetConsumerClaimAnalyticsQuery): Promise<UserRewardsAnalyticsResponse> {
		const { actor, input } = query;
		return this.weekly.customerAnalytics(requireCustomer(actor), input.query);
	}
}
