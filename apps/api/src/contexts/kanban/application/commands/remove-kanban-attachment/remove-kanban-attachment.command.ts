import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /admin/kanban/tasks/:taskId/attachments/:attachmentId`. */
export class RemoveKanbanAttachmentCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly attachmentId: string,
	) {
		super();
	}
}
