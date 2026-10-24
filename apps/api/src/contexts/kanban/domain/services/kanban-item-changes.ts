import { KANBAN_ACTIVITY_VALUE_MAX_LENGTH, type KanbanActivityField, type KanbanTaskPriority, type KanbanTeam, type UpdateKanbanTaskInput } from "@workspace/shared";

/** The fields of an item an edit can change, as they stand. */
export interface KanbanItemFields {
	readonly title: string;
	readonly description: string;
	readonly priority: KanbanTaskPriority;
	readonly team: KanbanTeam;
	readonly labels: readonly string[];
	readonly parentId: string | null;
	readonly assigneeId: string | null;
	readonly startAt: number | null;
	readonly dueAt: number | null;
	readonly storyPoints: number | null;
	readonly progress: number;
}

/** One field an edit changed, with its values as an activity row keeps them (ids still raw for the assignee and the parent). */
export interface KanbanFieldChange {
	readonly field: KanbanActivityField;
	readonly from: string | null;
	readonly to: string | null;
}

/** Just the editable fields of `item` (a stored record carries its id, level and version besides). */
export function itemFieldsOf(item: KanbanItemFields): KanbanItemFields {
	return {
		title: item.title,
		description: item.description,
		priority: item.priority,
		team: item.team,
		labels: item.labels,
		parentId: item.parentId,
		assigneeId: item.assigneeId,
		startAt: item.startAt,
		dueAt: item.dueAt,
		storyPoints: item.storyPoints,
		progress: item.progress,
	};
}

/** The item as it stands after `edit` (absent fields keep their value; the parent changes only through Move to…). */
export function applyItemEdit(before: KanbanItemFields, edit: UpdateKanbanTaskInput): KanbanItemFields {
	return {
		title: edit.title ?? before.title,
		description: edit.description ?? before.description,
		priority: edit.priority ?? before.priority,
		team: edit.team ?? before.team,
		labels: edit.labels ?? before.labels,
		parentId: before.parentId,
		assigneeId: edit.assigneeId === undefined ? before.assigneeId : edit.assigneeId,
		startAt: edit.startAt === undefined ? before.startAt : edit.startAt,
		dueAt: edit.dueAt === undefined ? before.dueAt : edit.dueAt,
		storyPoints: edit.storyPoints === undefined ? before.storyPoints : edit.storyPoints,
		progress: edit.progress ?? before.progress,
	};
}

/** A value as an activity row stores it: text, cut to the column's width. */
function asText(value: string | number | null): string | null {
	return value === null ? null : String(value).slice(0, KANBAN_ACTIVITY_VALUE_MAX_LENGTH);
}

function labelsText(labels: readonly string[]): string | null {
	return labels.length === 0 ? null : asText(labels.join(", "));
}

/**
 * Every field that differs between `before` and `after`, in a fixed order. A
 * description change records no text (it can be 2,000 characters); the history
 * says only that it changed.
 */
export function changedItemFields(before: KanbanItemFields, after: KanbanItemFields): readonly KanbanFieldChange[] {
	const changes: KanbanFieldChange[] = [];
	const compare = (field: KanbanActivityField, from: string | number | null, to: string | number | null): void => {
		if (from !== to) {
			changes.push({ field, from: asText(from), to: asText(to) });
		}
	};
	compare("TITLE", before.title, after.title);
	if (before.description !== after.description) {
		changes.push({ field: "DESCRIPTION", from: null, to: null });
	}
	compare("PRIORITY", before.priority, after.priority);
	compare("TEAM", before.team, after.team);
	if (before.labels.join("\n") !== after.labels.join("\n")) {
		changes.push({ field: "LABELS", from: labelsText(before.labels), to: labelsText(after.labels) });
	}
	compare("PARENT", before.parentId, after.parentId);
	compare("ASSIGNEE", before.assigneeId, after.assigneeId);
	compare("START", before.startAt, after.startAt);
	compare("DUE", before.dueAt, after.dueAt);
	compare("STORY_POINTS", before.storyPoints, after.storyPoints);
	compare("PROGRESS", before.progress, after.progress);
	return changes;
}
