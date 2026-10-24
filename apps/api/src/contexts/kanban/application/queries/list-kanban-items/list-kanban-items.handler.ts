import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanItemSummary, PaginatedServiceResult } from "@workspace/shared";

import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS } from "../../ports/kanban.tokens";
import { ListKanbanItemsQuery } from "./list-kanban-items.query";

/** One page of live items of either board — a parent or link picker's options. */
@QueryHandler(ListKanbanItemsQuery)
export class ListKanbanItemsHandler implements IQueryHandler<ListKanbanItemsQuery, PaginatedServiceResult<KanbanItemSummary>> {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	public execute(query: ListKanbanItemsQuery): Promise<PaginatedServiceResult<KanbanItemSummary>> {
		return this.reads.items(query.actor, query.input);
	}
}
