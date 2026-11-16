import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { DocsSyncOverview, DocsSyncRunDetail, DocsSyncRunSummary, PaginatedServiceResult } from "@workspace/shared";

import { NotFoundError } from "../../../../platform/application/errors/app-error";
import {
	DOCS_PUBLISHING_SETTINGS,
	DOCS_SYNC_DISPATCHER,
	DOCS_SYNC_RUN_READ,
	DOCS_WEBHOOK_HANDSHAKE_STORE,
	type DocsPublishingSettings,
	type DocsSyncDispatcherPort,
	type DocsSyncRunReadPort,
	type DocsWebhookHandshakeStorePort,
} from "../ports/docs-publishing.ports";
import { GetDocsSyncOverviewQuery, GetDocsSyncRunQuery, ListDocsSyncRunsQuery } from "./docs-sync.queries";

/** `GET /admin/docs-publishing/overview`. */
@QueryHandler(GetDocsSyncOverviewQuery)
export class GetDocsSyncOverviewHandler implements IQueryHandler<GetDocsSyncOverviewQuery, DocsSyncOverview> {
	public constructor(
		@Inject(DOCS_PUBLISHING_SETTINGS) private readonly settings: DocsPublishingSettings,
		@Inject(DOCS_SYNC_RUN_READ) private readonly reads: DocsSyncRunReadPort,
		@Inject(DOCS_WEBHOOK_HANDSHAKE_STORE) private readonly handshakes: DocsWebhookHandshakeStorePort,
		@Inject(DOCS_SYNC_DISPATCHER) private readonly dispatcher: DocsSyncDispatcherPort | null,
	) {}

	public async execute({ actor }: GetDocsSyncOverviewQuery): Promise<DocsSyncOverview> {
		const { notionWebhookSecret, reportToken } = this.settings;
		const [latest, handshake] = await Promise.all([this.reads.latest(actor), this.handshakes.find("NOTION")]);
		return {
			webhookConfigured: notionWebhookSecret !== null,
			dispatchConfigured: this.dispatcher !== null,
			reportingConfigured: reportToken !== null,
			handshakePending: handshake !== null,
			...latest,
		};
	}
}

/** `GET /admin/docs-publishing/runs`. */
@QueryHandler(ListDocsSyncRunsQuery)
export class ListDocsSyncRunsHandler implements IQueryHandler<ListDocsSyncRunsQuery, PaginatedServiceResult<DocsSyncRunSummary>> {
	public constructor(@Inject(DOCS_SYNC_RUN_READ) private readonly reads: DocsSyncRunReadPort) {}

	public execute(query: ListDocsSyncRunsQuery): Promise<PaginatedServiceResult<DocsSyncRunSummary>> {
		return this.reads.list(query.actor, query.input);
	}
}

/** `GET /admin/docs-publishing/runs/:id`; an unknown id is a 404. */
@QueryHandler(GetDocsSyncRunQuery)
export class GetDocsSyncRunHandler implements IQueryHandler<GetDocsSyncRunQuery, DocsSyncRunDetail> {
	public constructor(@Inject(DOCS_SYNC_RUN_READ) private readonly reads: DocsSyncRunReadPort) {}

	public async execute(query: GetDocsSyncRunQuery): Promise<DocsSyncRunDetail> {
		const run = await this.reads.findById(query.actor, query.input.id);
		if (run === null) {
			throw new NotFoundError({ message: "The requested resource was not found.", details: { resourceId: query.input.id } });
		}
		return run;
	}
}
