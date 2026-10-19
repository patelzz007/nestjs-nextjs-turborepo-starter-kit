import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { CustomerAnalyticsDashboard } from "@workspace/shared";

import { AnalyticsDashboardAssembler } from "../../assemblers/analytics-dashboard.assembler";
import { requireCustomer } from "../../assemblers/analytics-actor";
import { GetConsumerDashboardQuery } from "./get-consumer-dashboard.query";

@Injectable()
@QueryHandler(GetConsumerDashboardQuery)
export class GetConsumerDashboardHandler implements IQueryHandler<GetConsumerDashboardQuery, CustomerAnalyticsDashboard> {
	public constructor(private readonly dashboards: AnalyticsDashboardAssembler) {}

	public async execute(query: GetConsumerDashboardQuery): Promise<CustomerAnalyticsDashboard> {
		const { actor, input } = query;
		return this.dashboards.customerDashboard(requireCustomer(actor), input.query);
	}
}
