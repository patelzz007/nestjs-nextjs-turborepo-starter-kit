import { Query } from "@nestjs/cqrs";
import type { MerchantKybProfileResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The tenant's KYB profile (`merchant:manage_verification`, owner only in the role table). */
export class GetKybProfileQuery extends Query<MerchantKybProfileResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantSlug: string },
	) {
		super();
	}
}
