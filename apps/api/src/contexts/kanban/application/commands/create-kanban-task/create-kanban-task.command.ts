import { Command } from "@nestjs/cqrs";
import type { CreateKanbanTaskInput, KanbanTaskDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks`. */
export class CreateKanbanTaskCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: CreateKanbanTaskInput,
	) {
		super();
	}
}
