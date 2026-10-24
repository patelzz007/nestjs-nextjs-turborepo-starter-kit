import { Command } from "@nestjs/cqrs";
import type { CreateKanbanLinkInput, KanbanTaskDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks/:taskId/links`. */
export class AddKanbanLinkCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: CreateKanbanLinkInput,
	) {
		super();
	}
}
