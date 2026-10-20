import { Query } from "@nestjs/cqrs";
import type { MerchantAnalyticsDashboard, MerchantAnalyticsDashboardQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetMerchantDashboardInput {
	readonly tenantId: string;
	readonly query: MerchantAnalyticsDashboardQuery;
}

/** The merchant dashboard (`GET /tenants/:tenantSlug/analytics/dashboard`), limited to the caller's stores. */
export class GetMerchantDashboardQuery extends Query<MerchantAnalyticsDashboard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetMerchantDashboardInput,
	) {
		super();
	}
}
