import { Command } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `DELETE /admin/kanban/tasks/:taskId/links/:linkId`. */
export class RemoveKanbanLinkCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly linkId: string,
	) {
		super();
	}
}
