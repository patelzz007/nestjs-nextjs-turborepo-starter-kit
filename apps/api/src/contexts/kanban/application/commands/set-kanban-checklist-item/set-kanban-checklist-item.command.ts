import { Command } from "@nestjs/cqrs";
import type { KanbanTaskDetail, SetKanbanChecklistItemInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PATCH /admin/kanban/tasks/:taskId/checklist/:itemId`. */
export class SetKanbanChecklistItemCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly itemId: string,
		public readonly input: SetKanbanChecklistItemInput,
	) {
		super();
	}
}
