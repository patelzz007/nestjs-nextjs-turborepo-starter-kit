import { Command } from "@nestjs/cqrs";
import type { MerchantCreateRewardInput, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /orgs/:orgSlug/rewards`: the body plus the organization the merchant caller was resolved to. */
export type CreateRewardInput = MerchantCreateRewardInput & { readonly organizationId: string };

export class CreateRewardCommand extends Command<RewardResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateRewardInput,
	) {
		super();
	}
}
