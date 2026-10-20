import { Query } from "@nestjs/cqrs";
import type { AdminSalesAnalyticsQuery, AdminSalesAnalyticsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetAdminSalesAnalyticsInput {
	readonly query: AdminSalesAnalyticsQuery;
}

/** Platform-wide paid bills (`GET /admin/analytics/sales`); the route enforces `READ ANALYTICS`. */
export class GetAdminSalesAnalyticsQuery extends Query<AdminSalesAnalyticsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetAdminSalesAnalyticsInput,
	) {
		super();
	}
}
