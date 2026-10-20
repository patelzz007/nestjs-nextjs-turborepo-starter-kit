import { Command } from "@nestjs/cqrs";
import type { MerchantOnboardingDocumentBatchUploadCompleteInput, MerchantOnboardingDocumentBatchUploadCompleteResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Confirms several onboarding KYB uploads in one request; every id is checked before any is completed. */
export class CompleteOnboardingDocumentUploadsCommand extends Command<MerchantOnboardingDocumentBatchUploadCompleteResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingDocumentBatchUploadCompleteInput,
	) {
		super();
	}
}
