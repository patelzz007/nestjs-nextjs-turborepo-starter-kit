import { Command } from "@nestjs/cqrs";
import type { KanbanBoard, MoveKanbanTaskInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks/:taskId/move`. */
export class MoveKanbanTaskCommand extends Command<KanbanBoard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: MoveKanbanTaskInput,
	) {
		super();
	}
}
