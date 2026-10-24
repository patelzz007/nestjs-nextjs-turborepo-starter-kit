import { Command } from "@nestjs/cqrs";
import type { KanbanTaskDetail, UpdateKanbanTaskInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PATCH /admin/kanban/tasks/:taskId`. */
export class ReviseKanbanTaskCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: UpdateKanbanTaskInput,
	) {
		super();
	}
}
