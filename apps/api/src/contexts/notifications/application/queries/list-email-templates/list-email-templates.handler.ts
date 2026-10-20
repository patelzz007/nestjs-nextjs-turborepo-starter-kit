import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { EmailPreviewListResponse } from "@workspace/shared";

import { listTemplateMeta } from "../../../domain/templates/email-template.registry";
import { ListEmailTemplatesQuery } from "./list-email-templates.query";

@QueryHandler(ListEmailTemplatesQuery)
export class ListEmailTemplatesHandler implements IQueryHandler<ListEmailTemplatesQuery, EmailPreviewListResponse> {
	public execute(_query: ListEmailTemplatesQuery): Promise<EmailPreviewListResponse> {
		return Promise.resolve({ templates: listTemplateMeta() });
	}
}
