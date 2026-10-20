import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { MerchantOnboardingDocumentBatchUploadCompleteResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { assertOwnOnboardingUploads, resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_FILE_ACCESS, KYB_READ } from "../../ports/tenants.tokens";
import { CompleteOnboardingDocumentUploadsCommand } from "./complete-onboarding-document-uploads.command";

@CommandHandler(CompleteOnboardingDocumentUploadsCommand)
export class CompleteOnboardingDocumentUploadsHandler implements ICommandHandler<
	CompleteOnboardingDocumentUploadsCommand,
	MerchantOnboardingDocumentBatchUploadCompleteResponse
> {
	public constructor(
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CompleteOnboardingDocumentUploadsCommand): Promise<MerchantOnboardingDocumentBatchUploadCompleteResponse> {
		const { input } = command;
		const invite = await resolveDocumentsWindowInvite(this.kyb, this.tokens.hash(input.token), this.clock.now());
		const fileIds = input.completions.map((completion) => completion.fileId);
		await assertOwnOnboardingUploads(this.files, invite, fileIds);
		await Promise.all(input.completions.map(async (completion) => this.files.completeUpload(invite.acceptedByUserId, completion.fileId, completion.checksumSha256)));
		return { fileIds };
	}
}
