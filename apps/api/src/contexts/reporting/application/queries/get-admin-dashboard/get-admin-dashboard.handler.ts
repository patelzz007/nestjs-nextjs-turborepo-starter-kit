import { Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { AdminAnalyticsDashboard } from "@workspace/shared";

import { AnalyticsDashboardAssembler } from "../../assemblers/analytics-dashboard.assembler";
import { GetAdminDashboardQuery } from "./get-admin-dashboard.query";

@Injectable()
@QueryHandler(GetAdminDashboardQuery)
export class GetAdminDashboardHandler implements IQueryHandler<GetAdminDashboardQuery, AdminAnalyticsDashboard> {
	public constructor(private readonly dashboards: AnalyticsDashboardAssembler) {}

	public async execute(query: GetAdminDashboardQuery): Promise<AdminAnalyticsDashboard> {
		return this.dashboards.adminDashboard(query.input.query);
	}
}
