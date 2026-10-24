import { Command } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** `PUT` (`watching`) or `DELETE` (not) `/admin/kanban/tasks/:taskId/watch`: the caller follows the item, or stops. */
export class WatchKanbanTaskCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly watching: boolean,
	) {
		super();
	}
}
