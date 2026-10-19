import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { MerchantKybDocumentRecord, MerchantOnboardingDocumentStatusResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { isOwnKybUpload, toKybDocumentRecord } from "../../kyb-documents";
import { resolveDocumentsWindowInvite } from "../../onboarding-documents";
import type { InviteTokenPort } from "../../ports/invite-tokens.port";
import type { KybFileAccessPort } from "../../ports/kyb-files.port";
import type { KybReadPort } from "../../ports/kyb-read.port";
import { INVITE_TOKENS, KYB_FILE_ACCESS, KYB_READ } from "../../ports/organizations.tokens";
import { GetOnboardingDocumentStatusQuery } from "./get-onboarding-document-status.query";

/** Same document window as the upload endpoints (uniform 410 once closed); ids that are not this onboarding's uploads are omitted. */
@QueryHandler(GetOnboardingDocumentStatusQuery)
export class GetOnboardingDocumentStatusHandler implements IQueryHandler<GetOnboardingDocumentStatusQuery, MerchantOnboardingDocumentStatusResponse> {
	public constructor(
		@Inject(KYB_READ) private readonly kyb: KybReadPort,
		@Inject(KYB_FILE_ACCESS) private readonly files: KybFileAccessPort,
		@Inject(INVITE_TOKENS) private readonly tokens: InviteTokenPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(query: GetOnboardingDocumentStatusQuery): Promise<MerchantOnboardingDocumentStatusResponse> {
		const { input } = query;
		const invite = await resolveDocumentsWindowInvite(this.kyb, this.tokens.hash(input.token), this.clock.now());
		const found = await this.files.describe(input.fileIds);
		const documents = input.fileIds.flatMap((fileId): MerchantKybDocumentRecord[] => {
			const file = found.find((candidate) => candidate.id === fileId);
			return file !== undefined && isOwnKybUpload(file, invite.organizationId, invite.acceptedByUserId) ? [toKybDocumentRecord(file)] : [];
		});
		return { documents };
	}
}
