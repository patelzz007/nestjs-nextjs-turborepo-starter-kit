import { Query } from "@nestjs/cqrs";
import type { AdminMerchantListQuery, MerchantOrgResponse, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The admin list of merchant organizations. */
export class ListMerchantsQuery extends Query<PaginatedServiceResult<MerchantOrgResponse>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: AdminMerchantListQuery,
	) {
		super();
	}
}
