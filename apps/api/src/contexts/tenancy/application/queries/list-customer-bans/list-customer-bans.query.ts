import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, TenantCustomerBanListQuery, TenantCustomerBanResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the tenant's active customer bans (`merchant:manage_rewards`). */
export class ListCustomerBansQuery extends Query<PaginatedServiceResult<TenantCustomerBanResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string; readonly query: TenantCustomerBanListQuery },
	) {
		super();
	}
}
