import type { KanbanTaskDetail } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { KanbanTaskNotFoundError } from "../../domain/errors/kanban.errors";
import type { KanbanReadPort } from "../ports/kanban-read.port";

/** The item's detail after a change committed; a change to an item always answers with it. */
export async function readTaskDetail(reads: KanbanReadPort, actor: ActorContext, taskId: string): Promise<KanbanTaskDetail> {
	const detail = await reads.task(actor, taskId);
	if (detail === null) {
		throw new KanbanTaskNotFoundError(taskId);
	}
	return detail;
}
