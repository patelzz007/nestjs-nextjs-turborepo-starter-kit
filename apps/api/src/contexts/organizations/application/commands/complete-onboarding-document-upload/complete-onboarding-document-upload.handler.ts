import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CompleteFileUploadResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { assertOwnOnboardingUploads, resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_FILE_ACCESS, KYB_READ } from "../../ports/organizations.tokens";
import { CompleteOnboardingDocumentUploadCommand } from "./complete-onboarding-document-upload.command";

@CommandHandler(CompleteOnboardingDocumentUploadCommand)
export class CompleteOnboardingDocumentUploadHandler implements ICommandHandler<CompleteOnboardingDocumentUploadCommand, CompleteFileUploadResponse> {
	public constructor(
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CompleteOnboardingDocumentUploadCommand): Promise<CompleteFileUploadResponse> {
		const { input } = command;
		const invite = await resolveDocumentsWindowInvite(this.kyb, this.tokens.hash(input.token), this.clock.now());
		await assertOwnOnboardingUploads(this.files, invite, [input.fileId]);
		return this.files.completeUpload(invite.acceptedByUserId, input.fileId, input.checksumSha256);
	}
}
