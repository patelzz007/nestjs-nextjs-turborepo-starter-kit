import { Query } from "@nestjs/cqrs";
import type { AdminMerchantDetailResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One merchant tenant with its KYB payload, evidence and stores, for KYB review. */
export class GetMerchantDetailQuery extends Query<AdminMerchantDetailResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: { readonly tenantId: string },
	) {
		super();
	}
}
