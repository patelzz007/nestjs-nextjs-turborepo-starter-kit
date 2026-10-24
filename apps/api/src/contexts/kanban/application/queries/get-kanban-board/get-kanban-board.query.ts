import { Query } from "@nestjs/cqrs";
import type { KanbanBoard, KanbanBoardKind } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `GET /admin/kanban/board?board=…`. */
export class GetKanbanBoardQuery extends Query<KanbanBoard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly board: KanbanBoardKind,
	) {
		super();
	}
}
