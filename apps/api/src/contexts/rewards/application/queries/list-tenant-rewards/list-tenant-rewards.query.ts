import { Query } from "@nestjs/cqrs";
import type { MerchantRewardListQuery, PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/rewards`: the list query plus the tenant the merchant caller was resolved to. */
export type ListTenantRewardsInput = MerchantRewardListQuery & { readonly tenantId: string };

export class ListTenantRewardsQuery extends Query<PaginatedServiceResult<RewardResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListTenantRewardsInput,
	) {
		super();
	}
}
