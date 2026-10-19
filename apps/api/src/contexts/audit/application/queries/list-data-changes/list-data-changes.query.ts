import { Query } from "@nestjs/cqrs";
import type { DataChangeLogListQuery, DataChangeLogSummary, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One page of the row-level data-change trail (`GET /admin/data-changes`), newest first by default. */
export class ListDataChangesQuery extends Query<PaginatedServiceResult<DataChangeLogSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DataChangeLogListQuery,
	) {
		super();
	}
}
