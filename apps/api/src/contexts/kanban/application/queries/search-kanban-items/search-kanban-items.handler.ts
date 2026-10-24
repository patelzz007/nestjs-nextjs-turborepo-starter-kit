import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanSearchResults } from "@workspace/shared";

import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS } from "../../ports/kanban.tokens";
import { SearchKanbanItemsQuery } from "./search-kanban-items.query";

/** Live items ranked for a lookup — the command palette's Items group and the Move to… picker. */
@QueryHandler(SearchKanbanItemsQuery)
export class SearchKanbanItemsHandler implements IQueryHandler<SearchKanbanItemsQuery, KanbanSearchResults> {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	public execute(query: SearchKanbanItemsQuery): Promise<KanbanSearchResults> {
		return this.reads.search(query.actor, query.input);
	}
}
