import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { assertNever, type KanbanTaskDetail, type UpdateKanbanTaskInput } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { KanbanTaskNotFoundError, KanbanTaskStaleError } from "../../../domain/errors/kanban.errors";
import { assertKanbanItemRules } from "../../../domain/policies/kanban-hierarchy.policy";
import type { KanbanChecklistList, KanbanItemRecord } from "../../../domain/repositories/kanban.repositories";
import { planChecklistReplacement, type KanbanChecklistPlan, type KanbanChecklistRow, type KanbanChecklistRowInput } from "../../../domain/services/kanban-checklist-plan";
import { applyItemEdit, changedItemFields, type KanbanItemFields } from "../../../domain/services/kanban-item-changes";
import { actingStaffUserId } from "../../acting-user";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanAssigneesPort } from "../../ports/kanban-assignees.port";
import type { KanbanReadPort } from "../../ports/kanban-read.port";
import { KANBAN_ASSIGNEES, KANBAN_ID_GENERATOR, KANBAN_READS, KANBAN_UNIT_OF_WORK, KANBAN_WRITE_OPERATION, type KanbanIdGenerator } from "../../ports/kanban.tokens";
import { assertAssignable } from "../../services/kanban-assignees";
import { KanbanHistory } from "../../services/kanban-history";
import { readTaskDetail } from "../../services/kanban-task-detail";
import { ReviseKanbanTaskCommand } from "./revise-kanban-task.command";

/** One checklist an edit replaces: what is stored, and what writing the edit's rows takes. */
interface ChecklistReplacement {
	readonly list: KanbanChecklistList;
	readonly stored: readonly KanbanChecklistRow[];
	readonly plan: KanbanChecklistPlan;
}

/** An acceptance criterion as a checklist row: always a top-level row, never assigned. */
function criterionRow(criterion: NonNullable<UpdateKanbanTaskInput["acceptanceCriteria"]>[number]): KanbanChecklistRowInput {
	return { ...criterion, depth: 0, assigneeId: null };
}

/**
 * Edits an item's fields and replaces the checklists it sends (a subtask's
 * steps, a feature's or story's acceptance criteria). Under the board lock (the
 * hierarchy is read one edit at a time) and optimistic: the edit applies only
 * while the item is still at the `version` the client read, so an edit based on
 * a stale read answers 409 instead of overwriting someone else's change. The
 * hierarchy's rules are checked against the item as it would stand; every
 * changed field goes into its history, people by name. The parent is changed by
 * Move to… (`MoveKanbanItemToParentHandler`), never here.
 */
@CommandHandler(ReviseKanbanTaskCommand)
export class ReviseKanbanTaskHandler implements ICommandHandler<ReviseKanbanTaskCommand, KanbanTaskDetail> {
	public constructor(
		@Inject(KANBAN_UNIT_OF_WORK) private readonly uow: UnitOfWork<KanbanScope>,
		@Inject(KANBAN_READS) private readonly reads: KanbanReadPort,
		@Inject(KANBAN_ID_GENERATOR) private readonly ids: KanbanIdGenerator,
		@Inject(KANBAN_ASSIGNEES) private readonly assignees: KanbanAssigneesPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviseKanbanTaskCommand): Promise<KanbanTaskDetail> {
		const { actor, taskId, input } = command;
		const editorId = actingStaffUserId(actor);
		const history = new KanbanHistory(this.ids, editorId);

		await this.uow.runSystemOperation(KANBAN_WRITE_OPERATION, actor, async (scope: KanbanScope): Promise<void> => {
			await scope.board.lockForUpdate();
			const before = await scope.tasks.findLive(taskId);
			if (before === null) {
				throw new KanbanTaskNotFoundError(taskId);
			}
			if (before.version !== input.version) {
				throw new KanbanTaskStaleError(taskId);
			}
			const after = applyItemEdit(before, input);
			const steps = await this.replacement(scope, taskId, "STEPS", input.steps);
			const criteria = await this.replacement(scope, taskId, "ACCEPTANCE_CRITERIA", input.acceptanceCriteria?.map(criterionRow));
			assertKanbanItemRules({
				...after,
				type: before.type,
				stepCount: input.steps?.length ?? (await scope.checklist.listLive(taskId, "STEPS")).length,
				acceptanceCriterionCount: input.acceptanceCriteria?.length ?? (await scope.checklist.listLive(taskId, "ACCEPTANCE_CRITERIA")).length,
			});
			await assertAssignable(this.assignees, actor, [after.assigneeId === before.assigneeId ? null : after.assigneeId, ...newlyAssigned(steps)]);

			const outcome = await scope.tasks.revise(taskId, after, input.version);
			switch (outcome) {
				case "revised":
					break;
				case "stale":
					throw new KanbanTaskStaleError(taskId);
				case "missing":
					throw new KanbanTaskNotFoundError(taskId);
				default:
					return assertNever(outcome, "kanban task revision");
			}
			for (const replacement of [steps, criteria]) {
				if (replacement?.plan.changed === true) {
					await scope.checklist.apply(taskId, replacement.list, replacement.plan, editorId, this.clock.now());
					history.record(taskId, "UPDATED", {
						field: replacement.list,
						from: String(replacement.stored.length),
						to: String(replacement.stored.length - replacement.plan.removals.length + replacement.plan.creates.length),
					});
				}
			}
			await this.recordFieldChanges(scope, history, before, after);
			await scope.activity.append(history.entries());
		});

		return readTaskDetail(this.reads, actor, taskId);
	}

	/** The plan for a checklist the edit sends (`undefined`: the edit leaves it alone). */
	private async replacement(
		scope: KanbanScope,
		taskId: string,
		list: KanbanChecklistList,
		rows: readonly KanbanChecklistRowInput[] | undefined,
	): Promise<ChecklistReplacement | undefined> {
		if (rows === undefined) {
			return undefined;
		}
		const stored = await scope.checklist.listLive(taskId, list);
		return { list, stored, plan: planChecklistReplacement(stored, rows, () => this.ids.next()) };
	}

	/** One history row per changed field; an assignee is recorded by name, as it read at the time. */
	private async recordFieldChanges(scope: KanbanScope, history: KanbanHistory, before: KanbanItemRecord, after: KanbanItemFields): Promise<void> {
		const changes = changedItemFields(before, after);
		const personIds = changes.flatMap((change) => (change.field === "ASSIGNEE" ? [change.from, change.to] : [])).flatMap((id) => (id === null ? [] : [id]));
		const names = await scope.people.namesOf(personIds);
		for (const change of changes) {
			const lookup = change.field === "ASSIGNEE" ? names : null;
			history.record(before.id, "UPDATED", {
				field: change.field,
				from: lookup === null || change.from === null ? change.from : (lookup.get(change.from) ?? change.from),
				to: lookup === null || change.to === null ? change.to : (lookup.get(change.to) ?? change.to),
			});
		}
	}
}

/** Step assignees the edit adds that the stored list did not have. */
function newlyAssigned(replacement: ChecklistReplacement | undefined): readonly (string | null)[] {
	if (replacement === undefined) {
		return [];
	}
	const stored = new Set(replacement.stored.map((row) => row.assigneeId));
	return [...replacement.plan.creates, ...replacement.plan.updates].map((row) => row.assigneeId).filter((assigneeId) => !stored.has(assigneeId));
}
