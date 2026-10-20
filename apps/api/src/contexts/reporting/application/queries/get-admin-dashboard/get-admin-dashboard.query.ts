import { Query } from "@nestjs/cqrs";
import type { AdminAnalyticsDashboard, AdminAnalyticsDashboardQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetAdminDashboardInput {
	readonly query: AdminAnalyticsDashboardQuery;
}

/** The platform dashboard (`GET /admin/analytics/dashboard`); the route enforces `READ ANALYTICS`. */
export class GetAdminDashboardQuery extends Query<AdminAnalyticsDashboard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetAdminDashboardInput,
	) {
		super();
	}
}
