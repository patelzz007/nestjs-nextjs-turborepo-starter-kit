import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanComment, PaginatedServiceResult } from "@workspace/shared";

import { KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS } from "../../ports/kanban.tokens";
import { ListKanbanCommentsQuery } from "./list-kanban-comments.query";

/** One page of a live task's comments, newest first. */
@QueryHandler(ListKanbanCommentsQuery)
export class ListKanbanCommentsHandler implements IQueryHandler<ListKanbanCommentsQuery, PaginatedServiceResult<KanbanComment>> {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	public async execute(query: ListKanbanCommentsQuery): Promise<PaginatedServiceResult<KanbanComment>> {
		const page = await this.reads.comments(query.actor, query.taskId, query.input);
		if (page === null) {
			throw new KanbanTaskNotFoundError(query.taskId);
		}
		return page;
	}
}
