import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { EmailPreview } from "@workspace/shared";

import type { MerchantInviteEmailPreviewPort } from "../../ports/organization-emails.port";
import { ORGANIZATION_EMAILS } from "../../ports/organizations.tokens";
import { PreviewMerchantInviteEmailQuery } from "./preview-merchant-invite-email.query";

@QueryHandler(PreviewMerchantInviteEmailQuery)
export class PreviewMerchantInviteEmailHandler implements IQueryHandler<PreviewMerchantInviteEmailQuery, EmailPreview> {
	public constructor(@Inject(ORGANIZATION_EMAILS) private readonly emails: MerchantInviteEmailPreviewPort) {}

	public execute(query: PreviewMerchantInviteEmailQuery): Promise<EmailPreview> {
		return Promise.resolve(this.emails.previewMerchantInvite(query.input));
	}
}
