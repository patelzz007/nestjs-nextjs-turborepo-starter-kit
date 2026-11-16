import { Query } from "@nestjs/cqrs";
import type { DocsSyncOverview, DocsSyncRunDetail, DocsSyncRunIdParam, DocsSyncRunListQuery, DocsSyncRunSummary, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** What is set up on this server, and how the latest runs went. */
export class GetDocsSyncOverviewQuery extends Query<DocsSyncOverview> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}

/** One page of the sync runs (newest first by default). */
export class ListDocsSyncRunsQuery extends Query<PaginatedServiceResult<DocsSyncRunSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DocsSyncRunListQuery,
	) {
		super();
	}
}

/** One sync run with its held-back pages. */
export class GetDocsSyncRunQuery extends Query<DocsSyncRunDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DocsSyncRunIdParam,
	) {
		super();
	}
}
