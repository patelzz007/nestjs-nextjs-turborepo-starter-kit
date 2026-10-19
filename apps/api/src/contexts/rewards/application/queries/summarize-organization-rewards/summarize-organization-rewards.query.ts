import { Query } from "@nestjs/cqrs";
import type { MerchantRewardSummary, MerchantRewardSummaryQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/rewards/summary`: the store scope plus the organization the merchant caller was resolved to. */
export type SummarizeOrganizationRewardsInput = MerchantRewardSummaryQuery & { readonly organizationId: string };

export class SummarizeOrganizationRewardsQuery extends Query<MerchantRewardSummary> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: SummarizeOrganizationRewardsInput,
	) {
		super();
	}
}
