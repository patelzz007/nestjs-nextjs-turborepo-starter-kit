import { Query } from "@nestjs/cqrs";
import type { MerchantApiKeyListQuery, MerchantApiKeySummary, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /orgs/:orgSlug/api-keys`. */
export class ListApiKeysQuery extends Query<PaginatedServiceResult<MerchantApiKeySummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantApiKeyListQuery & { readonly organizationId: string },
	) {
		super();
	}
}
