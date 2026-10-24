import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { KanbanBoard } from "@workspace/shared";

import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS } from "../../ports/kanban.tokens";
import { GetKanbanBoardQuery } from "./get-kanban-board.query";

/** One board: its columns left to right, each with its live items top to bottom (bounded by `KANBAN_COLUMN_TASK_LIMIT`). */
@QueryHandler(GetKanbanBoardQuery)
export class GetKanbanBoardHandler implements IQueryHandler<GetKanbanBoardQuery, KanbanBoard> {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	public execute(query: GetKanbanBoardQuery): Promise<KanbanBoard> {
		return this.reads.board(query.actor, query.board);
	}
}
