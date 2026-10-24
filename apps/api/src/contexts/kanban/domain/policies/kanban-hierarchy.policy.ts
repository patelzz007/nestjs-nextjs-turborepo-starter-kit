import { KANBAN_PARENT_TYPE, kanbanItemRuleIssues, type KanbanItemRuleFields, type KanbanItemType } from "@workspace/shared";

import { KanbanItemRuleViolatedError, KanbanParentInvalidError } from "../errors/kanban.errors";

/** A live item as a parent check reads it. */
export interface KanbanParentCandidate {
	readonly id: string;
	readonly type: KanbanItemType;
}

/** Refuses an item that, as it would stand, breaks a hierarchy rule (`kanbanItemRuleIssues`, shared with the forms). */
export function assertKanbanItemRules(fields: KanbanItemRuleFields): void {
	const issues = kanbanItemRuleIssues(fields);
	if (issues.length > 0) {
		throw new KanbanItemRuleViolatedError(issues);
	}
}

/**
 * Refuses a parent that is not a live item exactly one level above `type`
 * (a feature's epic, a story's feature, a task's story), or that is the item
 * itself. `parent` is what the lookup of `parentId` found (`null`: missing or deleted).
 */
export function assertParentFits(itemId: string | null, type: KanbanItemType, parentId: string | null, parent: KanbanParentCandidate | null): void {
	if (parentId === null) {
		return;
	}
	const expected = KANBAN_PARENT_TYPE[type];
	if (parent === null || parent.id === itemId || parent.type !== expected) {
		throw new KanbanParentInvalidError(parentId, expected);
	}
}
