import { Query } from "@nestjs/cqrs";
import type { MerchantAnalyticsResponse, RewardsAnalyticsQuery } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface GetMerchantAnalyticsInput {
	readonly organizationId: string;
	readonly query: RewardsAnalyticsQuery;
}

/** One merchant's weekly analytics (`GET /orgs/:orgSlug/analytics`), limited to the caller's stores. */
export class GetMerchantAnalyticsQuery extends Query<MerchantAnalyticsResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GetMerchantAnalyticsInput,
	) {
		super();
	}
}
