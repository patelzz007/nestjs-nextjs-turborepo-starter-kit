import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanTaskDetail } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanChecklistItemNotFoundError, KanbanTaskNotFoundError } from "../../../domain/errors/kanban.errors";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { KanbanHistory } from "../../services/kanban-history";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { SetKanbanChecklistItemCommand } from "./set-kanban-checklist-item.command";

/**
 * Ticks a subtask or an acceptance criterion off (or on again) — a set, not a
 * toggle, so a retried request lands the same. Under the item's row lock; a
 * real change bumps the item's version, so an edit page opened before it is
 * refused instead of writing the old state back.
 */
@CommandHandler(SetKanbanChecklistItemCommand)
export class SetKanbanChecklistItemHandler implements ICommandHandler<SetKanbanChecklistItemCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
	) {}

	public async execute(command: SetKanbanChecklistItemCommand): Promise<KanbanTaskDetail> {
		const { actor, taskId, itemId, input } = command;
		const history = new KanbanHistory(this.ids, actingStaffUserId(actor));

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			if (!(await scope.tasks.lockLive(taskId))) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			const item = await scope.checklist.findLive(taskId, itemId);
			if (item === null) {
				throw new KanbanChecklistItemNotFoundError(itemId);
			}
			if (item.isDone === input.isDone) {
				return;
			}
			await scope.checklist.setDone(itemId, input.isDone);
			await scope.tasks.touch(taskId);
			history.record(taskId, input.isDone ? "CHECKED" : "UNCHECKED", { field: item.list, to: item.title });
			await scope.activity.append(history.entries());
		});

		return readTaskDetail(this.reads, actor, taskId);
	}
}
