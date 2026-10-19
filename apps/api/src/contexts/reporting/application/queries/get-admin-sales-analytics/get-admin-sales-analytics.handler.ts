import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminSalesAnalyticsResponse } from "@workspace/shared";

import { WeeklyAnalyticsAssembler } from "../../assemblers/weekly-analytics.assembler";
import { actorUserIdOf } from "../../assemblers/analytics-actor";
import { GetAdminSalesAnalyticsQuery } from "./get-admin-sales-analytics.query";

@Injectable()
@QueryHandler(GetAdminSalesAnalyticsQuery)
export class GetAdminSalesAnalyticsHandler implements IQueryHandler<GetAdminSalesAnalyticsQuery, AdminSalesAnalyticsResponse> {
	public constructor(private readonly weekly: WeeklyAnalyticsAssembler) {}

	public async execute(query: GetAdminSalesAnalyticsQuery): Promise<AdminSalesAnalyticsResponse> {
		const { actor, input } = query;
		return this.weekly.adminSalesAnalytics(actorUserIdOf(actor), input.query);
	}
}
