import { Query } from "@nestjs/cqrs";
import type { MerchantOnboardingInvitePreview, MerchantOnboardingValidateTokenInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** What a merchant onboarding link offers, shown before the merchant completes it. */
export class PreviewOnboardingInviteQuery extends Query<MerchantOnboardingInvitePreview> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingValidateTokenInput,
	) {
		super();
	}
}
