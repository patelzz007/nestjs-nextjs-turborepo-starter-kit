import { Query } from "@nestjs/cqrs";
import type { MerchantKybProfileResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The organization's KYB profile (`merchant:manage_verification`, owner only in the role table). */
export class GetKybProfileQuery extends Query<MerchantKybProfileResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly orgSlug: string },
	) {
		super();
	}
}
