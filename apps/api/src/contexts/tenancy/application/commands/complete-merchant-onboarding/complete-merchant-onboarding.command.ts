import { Command } from "@nestjs/cqrs";
import type { MerchantOnboardingCompleteFieldsInput, MerchantOnboardingCompleteResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** The invited merchant finishes onboarding: account, owner membership, business details, stores, activation. */
export class CompleteMerchantOnboardingCommand extends Command<MerchantOnboardingCompleteResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingCompleteFieldsInput,
	) {
		super();
	}
}
