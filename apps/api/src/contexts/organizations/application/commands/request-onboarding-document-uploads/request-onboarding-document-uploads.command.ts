import { Command } from "@nestjs/cqrs";
import type { MerchantOnboardingDocumentBatchUploadUrlInput, MerchantOnboardingDocumentBatchUploadUrlResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Upload tickets for several KYB documents in one request (same window as the single ticket). */
export class RequestOnboardingDocumentUploadsCommand extends Command<MerchantOnboardingDocumentBatchUploadUrlResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingDocumentBatchUploadUrlInput,
	) {
		super();
	}
}
