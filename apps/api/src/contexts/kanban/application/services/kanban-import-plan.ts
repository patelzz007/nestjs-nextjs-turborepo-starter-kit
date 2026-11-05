import type { CreateKanbanTaskInput, KanbanBoardKind } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { KanbanBoardArrangement, KanbanTaskPlacement } from "../../domain/aggregates/kanban-board-arrangement.aggregate";
import { KanbanAssigneeInvalidError } from "../../domain/errors/kanban.errors";
import { assertColumnForLevel } from "../../domain/policies/kanban-column.policy";
import { assertKanbanItemRules, assertParentFits } from "../../domain/policies/kanban-hierarchy.policy";
import type { KanbanItemRefRecord } from "../../domain/repositories/kanban.repositories";
import type { KanbanAssigneesPort } from "../ports/kanban-assignees.port";
import type { KanbanScope } from "../kanban-scope";

/** What every row of one import is checked against: the board as it is now, under the board lock. */
export interface KanbanImportContext {
	readonly board: KanbanBoardKind;
	readonly arrangement: KanbanBoardArrangement;
	readonly parents: readonly KanbanItemRefRecord[];
	readonly assignable: ReadonlySet<string>;
}

/** Loads one import's context inside its transaction (the board locked, so the checks hold until commit). */
export async function loadKanbanImportContext(
	scope: KanbanScope,
	assignees: KanbanAssigneesPort,
	actor: ActorContext,
	board: KanbanBoardKind,
	tasks: readonly CreateKanbanTaskInput[],
): Promise<KanbanImportContext> {
	const arrangement = await scope.board.lockForUpdate();
	const parents = await scope.tasks.findRefs(tasks.flatMap((task) => (task.parentId === null ? [] : [task.parentId])));
	// Asked only when a row names someone, as before: most imports assign nobody.
	const assignable = tasks.some((task) => task.assigneeId !== null) ? new Set(await assignees.assignableUserIds(actor)) : new Set<string>();
	return { board, arrangement, parents, assignable };
}

/**
 * Checks one imported row against the board and places it at the bottom of its column (enhancement 5.8). The one
 * set of rules for both the import (which stops at the first refusal: all or none) and its dry run (which collects
 * every refusal), so a dry run can never pass a row the import would refuse. Throws the row's domain error.
 */
export function placeImportedTask(context: KanbanImportContext, task: CreateKanbanTaskInput, taskId: string): KanbanTaskPlacement {
	assertColumnForLevel(task.type, { id: task.columnId, board: context.board });
	assertKanbanItemRules({ ...task, stepCount: 0, acceptanceCriterionCount: 0 });
	if (task.assigneeId !== null && !context.assignable.has(task.assigneeId)) {
		throw new KanbanAssigneeInvalidError(task.assigneeId);
	}
	assertParentFits(null, task.type, task.parentId, context.parents.find((parent) => parent.id === task.parentId) ?? null);
	return context.arrangement.placeNewTask(taskId, task.columnId, task.type);
}
