import { Query } from "@nestjs/cqrs";
import type { AdminMerchantListQuery, MerchantTenantResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The admin list of merchant tenants. */
export class ListMerchantsQuery extends Query<PaginatedServiceResult<MerchantTenantResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminMerchantListQuery,
	) {
		super();
	}
}
