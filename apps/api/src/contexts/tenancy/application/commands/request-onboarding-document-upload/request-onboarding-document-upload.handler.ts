import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { CreateFileUploadUrlResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_FILE_ACCESS, KYB_READ } from "../../ports/tenants.tokens";
import { RequestOnboardingDocumentUploadCommand } from "./request-onboarding-document-upload.command";

@CommandHandler(RequestOnboardingDocumentUploadCommand)
export class RequestOnboardingDocumentUploadHandler implements ICommandHandler<RequestOnboardingDocumentUploadCommand, CreateFileUploadUrlResponse> {
	public constructor(
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RequestOnboardingDocumentUploadCommand): Promise<CreateFileUploadUrlResponse> {
		const { input } = command;
		const invite = await resolveDocumentsWindowInvite(this.kyb, this.tokens.hash(input.token), this.clock.now());
		return this.files.createUploadUrl(invite.acceptedByUserId, invite.tenantId, {
			fileName: input.fileName,
			mimeType: input.mimeType,
			sizeBytes: input.sizeBytes,
			checksumSha256: input.checksumSha256,
		});
	}
}
