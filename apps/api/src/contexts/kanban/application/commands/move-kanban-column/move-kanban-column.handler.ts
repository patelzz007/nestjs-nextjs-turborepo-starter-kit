import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanBoard, KanbanBoardKind } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION } from "../../ports/kanban.tokens";
import { MoveKanbanColumnCommand } from "./move-kanban-column.command";

/** Reorders a board's columns under the board lock; a move based on a stale read of the column answers 409. Answers that board. */
@CommandHandler(MoveKanbanColumnCommand)
export class MoveKanbanColumnHandler implements ICommandHandler<MoveKanbanColumnCommand, KanbanBoard> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
	) {}

	public async execute(command: MoveKanbanColumnCommand): Promise<KanbanBoard> {
		const { actor, columnId, input } = command;
		actingStaffUserId(actor);

		const boardKind = await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<KanbanBoardKind> => {
			const board = await scope.board.lockForUpdate();
			board.moveColumn(columnId, input.version, input.afterColumnId);
			await scope.board.saveArrangement(board);
			return board.boardOfColumn(columnId);
		});

		return this.reads.board(actor, boardKind);
	}
}
