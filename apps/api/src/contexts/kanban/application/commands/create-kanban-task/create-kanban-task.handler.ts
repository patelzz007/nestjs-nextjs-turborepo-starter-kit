import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { LIST_SLOT_INDEX, type KanbanTaskDetail } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { assertKanbanItemRules, assertParentFits } from "../../../domain/policies/kanban-hierarchy.policy";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanAssigneesPort } from "../../ports/kanban-assignees.port";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ASSIGNEES, KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { assertAssignable } from "../../services/kanban-assignees";
import { KanbanHistory } from "../../services/kanban-history";
import { nextKey } from "../../services/kanban-keys";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { CreateKanbanTaskCommand } from "./create-kanban-task.command";

/**
 * Adds an item at the bottom of its column, reported by the person creating it,
 * who watches it from then on, keyed from its level's counter (`STORY-143`).
 * Under the board lock: the column must be on the board the item's level lives
 * on (`assertColumnForLevel`), and the parent a live item one level up — so a
 * parent deleted at the same moment never ends up with a new child.
 */
@CommandHandler(CreateKanbanTaskCommand)
export class CreateKanbanTaskHandler implements ICommandHandler<CreateKanbanTaskCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
		@Inject(KANBAN_ASSIGNEES) private readonly assignees: KanbanAssigneesPort,
	) {}

	public async execute(command: CreateKanbanTaskCommand): Promise<KanbanTaskDetail> {
		const { actor, input } = command;
		const ownerId = actingStaffUserId(actor);
		assertKanbanItemRules({ ...input, stepCount: 0, acceptanceCriterionCount: 0 });
		await assertAssignable(this.assignees, actor, [input.assigneeId]);
		const taskId = this.ids.next();
		const history = new KanbanHistory(this.ids, ownerId);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			const board = await scope.board.lockForUpdate();
			const placement = board.placeNewTask(taskId, input.columnId, input.type);
			const parent = input.parentId === null ? null : ((await scope.tasks.findRefs([input.parentId])).at(LIST_SLOT_INDEX.first) ?? null);
			assertParentFits(null, input.type, input.parentId, parent);
			await scope.tasks.create({ id: taskId, key: await nextKey(scope.keys, input.type), ownerId, board: placement.board, position: placement.position, input });
			await scope.watchers.watch(this.ids.next(), taskId, ownerId);
			history.record(taskId, "CREATED", { to: await scope.board.columnTitle(input.columnId) });
			await scope.activity.append(history.entries());
		});

		return readTaskDetail(this.reads, actor, taskId);
	}
}
