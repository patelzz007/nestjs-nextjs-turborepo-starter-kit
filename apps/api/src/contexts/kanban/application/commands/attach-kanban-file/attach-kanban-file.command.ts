import { Command } from "@nestjs/cqrs";
import type { AttachKanbanFileInput, KanbanAttachment } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks/:taskId/attachments`. */
export class AttachKanbanFileCommand extends Command<KanbanAttachment> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: AttachKanbanFileInput,
	) {
		super();
	}
}
