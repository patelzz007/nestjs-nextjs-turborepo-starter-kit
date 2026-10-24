import { Query } from "@nestjs/cqrs";
import type { KanbanSearchQuery, KanbanSearchResults } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/search`. */
export class SearchKanbanItemsQuery extends Query<KanbanSearchResults> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: KanbanSearchQuery,
	) {
		super();
	}
}
