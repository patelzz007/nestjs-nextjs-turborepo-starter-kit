import { Command } from "@nestjs/cqrs";
import type { CreateKanbanCommentInput, KanbanComment } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `POST /admin/kanban/tasks/:taskId/comments`. */
export class AddKanbanCommentCommand extends Command<KanbanComment> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: CreateKanbanCommentInput,
	) {
		super();
	}
}
