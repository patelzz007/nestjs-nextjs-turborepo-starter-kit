import { Command } from "@nestjs/cqrs";
import type { KanbanTaskDetail, MoveKanbanItemToParentInput } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** Move to…: put an item under another parent one level up, at the version the client read. */
export class MoveKanbanItemToParentCommand extends Command<KanbanTaskDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly taskId: string,
		public readonly input: MoveKanbanItemToParentInput,
	) {
		super();
	}
}
