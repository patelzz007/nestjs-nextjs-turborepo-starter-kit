import { Command } from "@nestjs/cqrs";
import type { MerchantOnboardingDocumentsSubmitInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export interface OnboardingDocumentsSubmitted {
	readonly success: true;
}

/** Attaches the onboarding KYB evidence and consumes the token's single-use document window. */
export class SubmitOnboardingDocumentsCommand extends Command<OnboardingDocumentsSubmitted> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingDocumentsSubmitInput,
	) {
		super();
	}
}
