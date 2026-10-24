import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { assertNever, type KanbanTaskDetail } from "@workspace/shared";

import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanTaskNotFoundError, KanbanTaskStaleError } from "../../../domain/errors/kanban.errors";
import { assertKanbanItemRules, assertParentFits } from "../../../domain/policies/kanban-hierarchy.policy";
import type { KanbanItemRefRecord } from "../../../domain/repositories/kanban.repositories";
import { itemFieldsOf } from "../../../domain/services/kanban-item-changes";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { KanbanHistory } from "../../services/kanban-history";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { MoveKanbanItemToParentCommand } from "./move-kanban-item-to-parent.command";

/** How a parent reads in the history: its key and title as they were (`FEATURE-12 Checkout`), so later renames never rewrite it. */
function parentLabel(parent: KanbanItemRefRecord | null): string | null {
	if (parent === null) {
		return null;
	}
	return parent.key === null ? parent.title : `${parent.key} ${parent.title}`;
}

/**
 * Move to…: the one way an item changes parent (a card never changes lane by
 * being dragged). Under the board lock, so the new parent cannot be deleted at
 * the same moment, and optimistic on the item's `version`. The new parent must
 * be a live item exactly one level up — a story under another feature, a task
 * under another story, a subtask under another task — and the item keeps its
 * column and place. The history records the old and the new parent; undoing is
 * the same call back with the version this answers.
 */
@CommandHandler(MoveKanbanItemToParentCommand)
export class MoveKanbanItemToParentHandler implements ICommandHandler<MoveKanbanItemToParentCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
	) {}

	public async execute(command: MoveKanbanItemToParentCommand): Promise<KanbanTaskDetail> {
		const { actor, taskId, input } = command;
		const history = new KanbanHistory(this.ids, actingStaffUserId(actor));

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			await scope.board.lockForUpdate();
			const before = await scope.tasks.findLive(taskId);
			if (before === null) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			if (before.version !== input.version) {
				throw new KanbanTaskStaleError(taskId);
			}
			if (before.parentId === input.parentId) {
				return;
			}
			const parents = await scope.tasks.findRefs([before.parentId, input.parentId].flatMap((id) => (id === null ? [] : [id])));
			const newParent = parents.find((parent) => parent.id === input.parentId) ?? null;
			assertParentFits(taskId, before.type, input.parentId, newParent);
			const [steps, criteria] = await Promise.all([scope.checklist.listLive(taskId, "STEPS"), scope.checklist.listLive(taskId, "ACCEPTANCE_CRITERIA")]);
			assertKanbanItemRules({ ...before, parentId: input.parentId, stepCount: steps.length, acceptanceCriterionCount: criteria.length });

			const outcome = await scope.tasks.revise(taskId, { ...itemFieldsOf(before), parentId: input.parentId }, input.version);
			switch (outcome) {
				case "revised":
					break;
				case "stale":
					throw new KanbanTaskStaleError(taskId);
				case "missing":
					throw new KanbanTaskNotFoundError(taskId);
				default:
					return assertNever(outcome, "kanban parent move");
			}
			const oldParent = parents.find((parent) => parent.id === before.parentId) ?? null;
			history.record(taskId, "UPDATED", { field: "PARENT", from: parentLabel(oldParent), to: parentLabel(newParent) });
			await scope.activity.append(history.entries());
		});

		return readTaskDetail(this.reads, actor, taskId);
	}
}
