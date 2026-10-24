import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanItemHasChildrenError, KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import { KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION } from "../../ports/kanban.tokens";
import { DeleteKanbanTaskCommand } from "./delete-kanban-task.command";

/**
 * Soft-deletes an item (its comments, attachments, checklists and links stay,
 * unreachable with it) and closes the gap it leaves in its column, under the
 * board lock. An item that still has live children is refused: deleting it
 * would orphan them, so they are deleted or re-parented first.
 */
@CommandHandler(DeleteKanbanTaskCommand)
export class DeleteKanbanTaskHandler implements ICommandHandler<DeleteKanbanTaskCommand, void> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: DeleteKanbanTaskCommand): Promise<void> {
		const { actor, taskId } = command;
		const deletedBy = actingStaffUserId(actor);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			const board = await scope.board.lockForUpdate();
			board.removeTask(taskId);
			if ((await scope.tasks.countLiveChildren(taskId)) > 0) {
				throw new KanbanItemHasChildrenError(taskId);
			}
			if (!(await scope.tasks.softDelete(taskId, deletedBy, this.clock.now()))) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			await scope.board.saveArrangement(board);
		});
	}
}
