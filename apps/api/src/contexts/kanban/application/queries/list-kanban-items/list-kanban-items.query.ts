import { Query } from "@nestjs/cqrs";
import type { KanbanItemListQuery, KanbanItemSummary, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/items`. */
export class ListKanbanItemsQuery extends Query<PaginatedServiceResult<KanbanItemSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: KanbanItemListQuery,
	) {
		super();
	}
}
