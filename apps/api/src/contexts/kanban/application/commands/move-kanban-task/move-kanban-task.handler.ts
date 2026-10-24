import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanBoard, KanbanBoardKind } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { KanbanHistory } from "../../services/kanban-history";
import { MoveKanbanTaskCommand } from "./move-kanban-task.command";

/**
 * Moves a card, within its column or to another column of its board, under
 * the board lock: two moves never interleave, so positions stay contiguous. A
 * move based on a stale read of the card answers 409; a move to another column
 * goes into the item's history. Answers the whole board after the move, so the
 * client replaces its copy in one step.
 */
@CommandHandler(MoveKanbanTaskCommand)
export class MoveKanbanTaskHandler implements ICommandHandler<MoveKanbanTaskCommand, KanbanBoard> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
	) {}

	public async execute(command: MoveKanbanTaskCommand): Promise<KanbanBoard> {
		const { actor, taskId, input } = command;
		const history = new KanbanHistory(this.ids, actingStaffUserId(actor));

		const boardKind = await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<KanbanBoardKind> => {
			const board = await scope.board.lockForUpdate();
			const fromColumnId = board.columnIdOf(taskId);
			board.moveTask(taskId, input.version, input.columnId, input.afterTaskId);
			await scope.board.saveArrangement(board);
			if (fromColumnId !== input.columnId) {
				history.record(taskId, "MOVED", { from: await scope.board.columnTitle(fromColumnId), to: await scope.board.columnTitle(input.columnId) });
				await scope.activity.append(history.entries());
			}
			return board.boardOfColumn(input.columnId);
		});

		return this.reads.board(actor, boardKind);
	}
}
