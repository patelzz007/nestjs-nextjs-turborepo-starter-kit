import { KANBAN_COLUMN_TASK_LIMIT, KANBAN_TASK_ATTACHMENT_LIMIT, type KanbanItemRuleIssue, type KanbanItemType } from "@workspace/shared";

import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** Missing or soft-deleted — both answered alike. */
export class KanbanTaskNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_TASK_NOT_FOUND";

	public constructor(public readonly taskId: string) {
		super("Task not found", { taskId });
	}
}

export class KanbanColumnNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_COLUMN_NOT_FOUND";

	public constructor(public readonly columnId: string) {
		super("Column not found", { columnId });
	}
}

/** The task changed since the client read it (another edit or move won): reload and retry. */
export class KanbanTaskStaleError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_TASK_STALE";

	public constructor(public readonly taskId: string) {
		super("The task was changed by someone else. Reload the board and try again.", { taskId });
	}
}

/** The column moved since the client read it: reload and retry. */
export class KanbanColumnStaleError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_COLUMN_STALE";

	public constructor(public readonly columnId: string) {
		super("The column was moved by someone else. Reload the board and try again.", { columnId });
	}
}

export class KanbanColumnFullError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_COLUMN_FULL";

	public constructor(public readonly columnId: string) {
		super(`A column holds at most ${String(KANBAN_COLUMN_TASK_LIMIT)} tasks.`, { columnId, limit: KANBAN_COLUMN_TASK_LIMIT });
	}
}

/** The move names an anchor that is not in the target column (or is the moved item itself). */
export class KanbanMoveAnchorInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_MOVE_ANCHOR_INVALID";

	public constructor(public readonly anchorId: string) {
		super("The item to place this after is not in the target column.", { anchorId });
	}
}

export class KanbanAttachmentLimitReachedError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_ATTACHMENT_LIMIT_REACHED";

	public constructor(public readonly taskId: string) {
		super(`A task holds at most ${String(KANBAN_TASK_ATTACHMENT_LIMIT)} attachments.`, { taskId, limit: KANBAN_TASK_ATTACHMENT_LIMIT });
	}
}

/** Not a READY task attachment upload of the caller's, or already attached to a task — answered alike. */
export class KanbanAttachmentFileInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_ATTACHMENT_FILE_INVALID";

	public constructor(public readonly fileId: string) {
		super("Attach a file you uploaded for a task, once it has finished processing.", { fileId });
	}
}

export class KanbanAttachmentNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_ATTACHMENT_NOT_FOUND";

	public constructor(public readonly attachmentId: string) {
		super("Attachment not found", { attachmentId });
	}
}

/** The column is on the other board from the one the item's level lives on (`assertColumnForLevel`). */
export class KanbanBoardMismatchError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_BOARD_MISMATCH";

	public constructor(public readonly columnId: string) {
		super("Epics and features live on the planning board; stories, tasks and subtasks on the execution board.", { columnId });
	}
}

/** Planning columns have no WIP limit: only the execution board limits work in progress. */
export class KanbanPlanningWipLimitError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_PLANNING_HAS_NO_WIP_LIMIT";

	public constructor(public readonly columnId: string) {
		super("Only execution columns have a WIP limit.", { columnId });
	}
}

/** The item as it would stand breaks one or more hierarchy rules (`kanbanItemRuleIssues`). */
export class KanbanItemRuleViolatedError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_ITEM_RULE_VIOLATED";

	public constructor(public readonly issues: readonly KanbanItemRuleIssue[]) {
		super(issues.map((issue) => issue.message).join(" "), { fields: issues.map((issue) => issue.field).join(",") });
	}
}

/** The parent is missing, deleted, not the level right above the item, or the item itself. */
export class KanbanParentInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_PARENT_INVALID";

	public constructor(
		public readonly parentId: string,
		public readonly expectedType: KanbanItemType | null,
	) {
		super(expectedType === null ? "This item has no parent level." : `Choose a live ${expectedType.toLowerCase()} as the parent.`, { parentId, expectedType });
	}
}

/** An item that still has live children is not deleted (they would be orphaned). */
export class KanbanItemHasChildrenError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_ITEM_HAS_CHILDREN";

	public constructor(public readonly taskId: string) {
		super("Delete or move this item's children first.", { taskId });
	}
}

/** The person cannot be assigned: not an active account holding READ on KANBAN_TASK. */
export class KanbanAssigneeInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_ASSIGNEE_INVALID";

	public constructor(public readonly userId: string) {
		super("Assign someone who can use the board.", { userId });
	}
}

/** The link points at the item itself or at a missing or deleted item. */
export class KanbanLinkInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_LINK_INVALID";

	public constructor(public readonly targetTaskId: string) {
		super("Link to another live item.", { targetTaskId });
	}
}

/** The two items are linked that way already (or block each other the other way round). */
export class KanbanLinkExistsError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_LINK_EXISTS";

	public constructor(public readonly targetTaskId: string) {
		super("These items are linked already.", { targetTaskId });
	}
}

export class KanbanLinkNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_LINK_NOT_FOUND";

	public constructor(public readonly linkId: string) {
		super("Link not found", { linkId });
	}
}

/** Missing, deleted, or a row of another item — answered alike. */
export class KanbanChecklistItemNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "KANBAN_CHECKLIST_ITEM_NOT_FOUND";

	public constructor(public readonly itemId: string) {
		super("Checklist item not found", { itemId });
	}
}
