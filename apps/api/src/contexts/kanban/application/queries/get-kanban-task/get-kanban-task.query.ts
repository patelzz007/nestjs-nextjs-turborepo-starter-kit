import { Query } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/tasks/:taskId`. */
export class GetKanbanTaskQuery extends Query<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
	) {
		super();
	}
}
