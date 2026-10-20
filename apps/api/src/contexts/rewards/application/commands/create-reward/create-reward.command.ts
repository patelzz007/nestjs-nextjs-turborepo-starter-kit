import { Command } from "@nestjs/cqrs";
import type { MerchantCreateRewardInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /tenants/:tenantSlug/rewards`: the body plus the tenant the merchant caller was resolved to. */
export type CreateRewardInput = MerchantCreateRewardInput & { readonly tenantId: string };

export class CreateRewardCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateRewardInput,
	) {
		super();
	}
}
