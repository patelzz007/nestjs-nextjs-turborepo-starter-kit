import { Command } from "@nestjs/cqrs";
import type { KanbanBoard, MoveKanbanColumnInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/columns/:columnId/move`. */
export class MoveKanbanColumnCommand extends Command<KanbanBoard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly columnId: string,
		public readonly input: MoveKanbanColumnInput,
	) {
		super();
	}
}
