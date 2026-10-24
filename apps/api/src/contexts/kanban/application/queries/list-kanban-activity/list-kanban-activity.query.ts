import { Query } from "@nestjs/cqrs";
import type { KanbanActivity, KanbanActivityListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/tasks/:taskId/activity`. */
export class ListKanbanActivityQuery extends Query<PaginatedServiceResult<KanbanActivity>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: KanbanActivityListQuery,
	) {
		super();
	}
}
