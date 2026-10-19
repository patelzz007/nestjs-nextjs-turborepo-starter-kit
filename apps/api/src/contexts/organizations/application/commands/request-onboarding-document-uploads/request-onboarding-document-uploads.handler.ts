import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { MerchantOnboardingDocumentBatchUploadUrlResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_FILE_ACCESS, KYB_READ } from "../../ports/organizations.tokens";
import { RequestOnboardingDocumentUploadsCommand } from "./request-onboarding-document-uploads.command";

@CommandHandler(RequestOnboardingDocumentUploadsCommand)
export class RequestOnboardingDocumentUploadsHandler implements ICommandHandler<RequestOnboardingDocumentUploadsCommand, MerchantOnboardingDocumentBatchUploadUrlResponse> {
	public constructor(
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestOnboardingDocumentUploadsCommand): Promise<MerchantOnboardingDocumentBatchUploadUrlResponse> {
		const { input } = command;
		const invite = await resolveDocumentsWindowInvite(this.kyb, this.tokens.hash(input.token), this.clock.now());
		const uploads = await Promise.all(input.files.map(async (file) => this.files.createUploadUrl(invite.acceptedByUserId, invite.organizationId, file)));
		return { uploads };
	}
}
