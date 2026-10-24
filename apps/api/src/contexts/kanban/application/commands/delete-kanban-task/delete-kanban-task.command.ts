import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /admin/kanban/tasks/:taskId`. */
export class DeleteKanbanTaskCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
	) {
		super();
	}
}
