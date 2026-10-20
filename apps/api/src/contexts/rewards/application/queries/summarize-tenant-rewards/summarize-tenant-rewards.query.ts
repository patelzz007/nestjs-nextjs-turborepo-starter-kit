import { Query } from "@nestjs/cqrs";
import type { MerchantRewardSummary, MerchantRewardSummaryQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /tenants/:tenantSlug/rewards/summary`: the store scope plus the tenant the merchant caller was resolved to. */
export type SummarizeTenantRewardsInput = MerchantRewardSummaryQuery & { readonly tenantId: string };

export class SummarizeTenantRewardsQuery extends Query<MerchantRewardSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SummarizeTenantRewardsInput,
	) {
		super();
	}
}
