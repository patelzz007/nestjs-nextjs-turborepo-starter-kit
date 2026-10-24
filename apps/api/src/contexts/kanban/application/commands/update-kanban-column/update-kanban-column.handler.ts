import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanBoard, KanbanBoardKind } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanColumnStaleError, KanbanPlanningWipLimitError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION } from "../../ports/kanban.tokens";
import { UpdateKanbanColumnCommand } from "./update-kanban-column.command";

/**
 * Sets or clears an execution column's soft WIP limit (planning has none). The
 * limit counts stories and tasks; subtasks are part of their task's work. Optimistic: it applies only while
 * the column is still at the `version` the client read. The limit warns, it
 * never refuses a card — the team decides what to do about a full column.
 */
@CommandHandler(UpdateKanbanColumnCommand)
export class UpdateKanbanColumnHandler implements ICommandHandler<UpdateKanbanColumnCommand, KanbanBoard> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
	) {}

	public async execute(command: UpdateKanbanColumnCommand): Promise<KanbanBoard> {
		const { actor, columnId, input } = command;
		actingStaffUserId(actor);

		const boardKind = await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<KanbanBoardKind> => {
			const board = await scope.board.lockForUpdate();
			const kind = board.boardOfColumn(columnId);
			if (kind === "PLANNING") {
				throw new KanbanPlanningWipLimitError(columnId);
			}
			if (!(await scope.board.setWipLimit(columnId, input.wipLimit, input.version))) {
				throw new KanbanColumnStaleError(columnId);
			}
			return kind;
		});

		return this.reads.board(actor, boardKind);
	}
}
