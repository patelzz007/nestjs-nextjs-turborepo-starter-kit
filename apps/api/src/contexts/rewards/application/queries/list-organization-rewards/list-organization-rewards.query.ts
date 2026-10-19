import { Query } from "@nestjs/cqrs";
import type { MerchantRewardListQuery, PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/rewards`: the list query plus the organization the merchant caller was resolved to. */
export type ListOrganizationRewardsInput = MerchantRewardListQuery & { readonly organizationId: string };

export class ListOrganizationRewardsQuery extends Query<PaginatedServiceResult<RewardResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ListOrganizationRewardsInput,
	) {
		super();
	}
}
