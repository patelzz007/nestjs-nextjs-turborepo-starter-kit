import { Query } from "@nestjs/cqrs";
import type { MerchantOnboardingDocumentStatusInput, MerchantOnboardingDocumentStatusResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Scan status of this onboarding's own KYB uploads, polled by the signed-out merchant. */
export class GetOnboardingDocumentStatusQuery extends Query<MerchantOnboardingDocumentStatusResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingDocumentStatusInput,
	) {
		super();
	}
}
