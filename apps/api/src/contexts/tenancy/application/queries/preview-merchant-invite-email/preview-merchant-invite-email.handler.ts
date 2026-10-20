import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { EmailPreview } from "@workspace/shared";

import type { MerchantInviteEmailPreviewPort } from "../../ports/tenant-emails.port";
import { TENANT_EMAILS } from "../../ports/tenants.tokens";
import { PreviewMerchantInviteEmailQuery } from "./preview-merchant-invite-email.query";

@QueryHandler(PreviewMerchantInviteEmailQuery)
export class PreviewMerchantInviteEmailHandler implements IQueryHandler<PreviewMerchantInviteEmailQuery, EmailPreview> {
	public constructor(@Inject(TENANT_EMAILS) private readonly emails: MerchantInviteEmailPreviewPort) {}

	public execute(query: PreviewMerchantInviteEmailQuery): Promise<EmailPreview> {
		return Promise.resolve(this.emails.previewMerchantInvite(query.input));
	}
}
