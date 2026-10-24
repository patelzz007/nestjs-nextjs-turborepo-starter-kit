import { Command } from "@nestjs/cqrs";
import type { KanbanBoard, UpdateKanbanColumnInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PATCH /admin/kanban/columns/:columnId`. */
export class UpdateKanbanColumnCommand extends Command<KanbanBoard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly columnId: string,
		public readonly input: UpdateKanbanColumnInput,
	) {
		super();
	}
}
