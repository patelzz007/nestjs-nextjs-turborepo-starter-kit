import { Command } from "@nestjs/cqrs";
import type { CompleteFileUploadResponse, MerchantOnboardingDocumentUploadCompleteInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Confirms one onboarding KYB upload (the token may only touch its own uploads). */
export class CompleteOnboardingDocumentUploadCommand extends Command<CompleteFileUploadResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingDocumentUploadCompleteInput,
	) {
		super();
	}
}
