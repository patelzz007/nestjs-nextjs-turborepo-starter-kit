import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanActivity, PaginatedServiceResult } from "@workspace/shared";

import { KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS } from "../../ports/kanban.tokens";
import { ListKanbanActivityQuery } from "./list-kanban-activity.query";

/** One page of a live item's history, newest first. */
@QueryHandler(ListKanbanActivityQuery)
export class ListKanbanActivityHandler implements IQueryHandler<ListKanbanActivityQuery, PaginatedServiceResult<KanbanActivity>> {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	public async execute(query: ListKanbanActivityQuery): Promise<PaginatedServiceResult<KanbanActivity>> {
		const page = await this.reads.activity(query.actor, query.taskId, query.input);
		if (page === null) {
			throw new KanbanTaskNotFoundError(query.taskId);
		}
		return page;
	}
}
