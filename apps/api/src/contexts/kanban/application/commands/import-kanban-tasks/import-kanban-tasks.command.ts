import { Command } from "@nestjs/cqrs";
import type { ImportKanbanTasksInput, KanbanBoard } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks/import`. */
export class ImportKanbanTasksCommand extends Command<KanbanBoard> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ImportKanbanTasksInput,
	) {
		super();
	}
}
