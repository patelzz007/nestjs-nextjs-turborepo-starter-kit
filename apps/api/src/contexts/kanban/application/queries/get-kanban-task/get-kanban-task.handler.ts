import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import { KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS } from "../../ports/kanban.tokens";
import { GetKanbanTaskQuery } from "./get-kanban-task.query";

/** One live task with its column and attachments. */
@QueryHandler(GetKanbanTaskQuery)
export class GetKanbanTaskHandler implements IQueryHandler<GetKanbanTaskQuery, KanbanTaskDetail> {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	public async execute(query: GetKanbanTaskQuery): Promise<KanbanTaskDetail> {
		const task = await this.reads.task(query.actor, query.taskId);
		if (task === null) {
			throw new KanbanTaskNotFoundError(query.taskId);
		}
		return task;
	}
}
