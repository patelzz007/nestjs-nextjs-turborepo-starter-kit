import { Command } from "@nestjs/cqrs";
import type { CreateFileUploadUrlResponse, MerchantOnboardingDocumentUploadUrlInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** An upload ticket for one KYB document, authorized by the onboarding token's open document window. */
export class RequestOnboardingDocumentUploadCommand extends Command<CreateFileUploadUrlResponse> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: MerchantOnboardingDocumentUploadUrlInput,
	) {
		super();
	}
}
