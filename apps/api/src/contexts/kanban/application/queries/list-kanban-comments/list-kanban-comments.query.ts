import { Query } from "@nestjs/cqrs";
import type { KanbanComment, KanbanCommentListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/tasks/:taskId/comments`. */
export class ListKanbanCommentsQuery extends Query<PaginatedServiceResult<KanbanComment>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: KanbanCommentListQuery,
	) {
		super();
	}
}
