import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, RewardCustomer, RewardCustomerListQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/rewards/customers`. */
export interface ListRewardCustomersInput extends RewardCustomerListQuery {
	readonly tenantId: string;
}

export class ListRewardCustomersQuery extends Query<PaginatedServiceResult<RewardCustomer>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListRewardCustomersInput,
	) {
		super();
	}
}
