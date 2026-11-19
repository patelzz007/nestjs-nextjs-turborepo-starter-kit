import { Inject, Injectable } from "@nestjs/common";
import type { EmailPreview, EmailPreviewListResponse, EmailRenderContext, EmailTemplateKey } from "@workspace/shared";

import { buildEmailPreview, listTemplateMeta } from "../../domain/templates/email-template.registry";
import { EMAIL_RENDER_CONTEXT } from "../ports/notifications.tokens";

/** The admin email template previews (ADR 096): sample props only, never real user data, never sent. */
@Injectable()
export class EmailPreviewApplicationService {
	public constructor(@Inject(EMAIL_RENDER_CONTEXT) private readonly renderContext: EmailRenderContext) {}

	/** Static metadata of every template (the admin preview index). */
	public listTemplates(): EmailPreviewListResponse {
		return { templates: listTemplateMeta() };
	}

	/** Rendered HTML + text of one template with its sample props. */
	public preview(templateKey: EmailTemplateKey): EmailPreview {
		return buildEmailPreview(templateKey, this.renderContext);
	}
}
