import { Query } from "@nestjs/cqrs";
import type { MerchantRedemptionListItem, MerchantRedemptionListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/redemptions` (members and integration keys). */
export class ListOrganizationRedemptionsQuery extends Query<PaginatedServiceResult<MerchantRedemptionListItem>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantRedemptionListQuery & { readonly organizationId: string },
	) {
		super();
	}
}
