import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { KanbanBoard } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import type { NewKanbanTask } from "../../../domain/repositories/kanban.repositories";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanAssigneesPort } from "../../ports/kanban-assignees.port";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ASSIGNEES, KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { KanbanHistory } from "../../services/kanban-history";
import { loadKanbanImportContext, placeImportedTask } from "../../services/kanban-import-plan";
import { withKeys } from "../../services/kanban-keys";
import { ImportKanbanTasksCommand } from "./import-kanban-tasks.command";

/**
 * Adds several items to one board at once (a CSV import), in order, each at
 * the bottom of its column, all reported (and watched) by the importer. One
 * transaction under the board lock: an item for the other board, an unknown or
 * full column, an assignee who can't use the board, or a parent that does not fit
 * refuses the whole import, so it never half-lands. The rows are checked by
 * `placeImportedTask`, the same rules its dry run reports per row (5.8).
 */
@CommandHandler(ImportKanbanTasksCommand)
export class ImportKanbanTasksHandler implements ICommandHandler<ImportKanbanTasksCommand, KanbanBoard> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
		@Inject(KANBAN_ASSIGNEES) private readonly assignees: KanbanAssigneesPort,
	) {}

	public async execute(command: ImportKanbanTasksCommand): Promise<KanbanBoard> {
		const { actor, input } = command;
		const ownerId = actingStaffUserId(actor);
		const history = new KanbanHistory(this.ids, ownerId);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			const context = await loadKanbanImportContext(scope, this.assignees, actor, input.board, input.tasks);
			const tasks = (await withKeys(scope.keys, input.tasks)).map(({ item: task, key }): NewKanbanTask => {
				const id = this.ids.next();
				const placement = placeImportedTask(context, task, id);
				return { id, key, ownerId, board: placement.board, position: placement.position, input: task };
			});
			await scope.tasks.createMany(tasks);
			for (const task of tasks) {
				await scope.watchers.watch(this.ids.next(), task.id, ownerId);
				history.record(task.id, "CREATED", { to: await scope.board.columnTitle(task.input.columnId) });
			}
			await scope.activity.append(history.entries());
		});

		return this.reads.board(actor, input.board);
	}
}
