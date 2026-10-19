import { Query } from "@nestjs/cqrs";
import type { CustomerAnalyticsDashboard, CustomerAnalyticsDashboardQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetConsumerDashboardInput {
	readonly query: CustomerAnalyticsDashboardQuery;
}

/** The signed-in customer's own dashboard (`GET /claims/analytics/dashboard`): self only, the user comes from the actor. */
export class GetConsumerDashboardQuery extends Query<CustomerAnalyticsDashboard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetConsumerDashboardInput,
	) {
		super();
	}
}
