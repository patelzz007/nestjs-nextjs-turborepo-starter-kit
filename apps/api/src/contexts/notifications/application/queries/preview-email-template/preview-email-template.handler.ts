import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { EmailPreview, EmailRenderContext } from "@workspace/shared";

import { buildEmailPreview } from "../../../domain/templates/email-template.registry";
import { EMAIL_RENDER_CONTEXT } from "../../ports/notifications.tokens";
import { PreviewEmailTemplateQuery } from "./preview-email-template.query";

@QueryHandler(PreviewEmailTemplateQuery)
export class PreviewEmailTemplateHandler implements IQueryHandler<PreviewEmailTemplateQuery, EmailPreview> {
	public constructor(@Inject(EMAIL_RENDER_CONTEXT) private readonly renderContext: EmailRenderContext) {}

	public execute(query: PreviewEmailTemplateQuery): Promise<EmailPreview> {
		return Promise.resolve(buildEmailPreview(query.input.templateKey, this.renderContext));
	}
}
