// ============================================
// contexts/kanban/lib/kanban-task-form.ts - the item forms' values ⇄ the shared contracts
// ============================================
// The forms hold strings (a `yyyy-MM-dd` date, a points or progress text, a
// comma-separated label list, `""` for "no parent" / "unassigned"); the
// converters turn them into the `CreateKanbanTaskSchema` / `UpdateKanbanTaskSchema`
// shapes, which then validate them — the same schemas the API validates the
// request with, so a form shows exactly the API's rules (the hierarchy's too).
// Field names match the contract's, so a contract issue lands on its field.

import { NullableNumberInputSchema, RequiredNumberInputSchema, contractFormSchema } from "@workspace/client/lib/forms/contract-form-schema";
import {
	CreateKanbanTaskSchema,
	KANBAN_STEP_MAX_DEPTH,
	KANBAN_PARENT_TYPE,
	KanbanItemTypeSchema,
	KanbanTaskPrioritySchema,
	KanbanTeamSchema,
	newRowId,
	UpdateKanbanTaskSchema,
	type KanbanItemType,
	type KanbanTaskDetail,
	type KanbanTaskPriority,
	type KanbanTeam,
} from "@workspace/shared";
import { z } from "zod";

/** `yyyy-MM-dd`, as a date input and the date picker hold it. */
const DATE_INPUT_PATTERN = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/;

/** Calendar month numbers run from 1; `Date` months from 0. */
const MONTH_OFFSET = 1;
const DATE_PART_WIDTH = 2;
/** Labels are typed as one comma-separated line. */
const LABEL_SEPARATOR = ",";

/** A `yyyy-MM-dd` date → epoch ms of that day's local midnight; `null` for a blank or malformed date. */
export function dateInputToEpochMs(value: string): number | null {
	const groups = DATE_INPUT_PATTERN.exec(value.trim())?.groups;
	if (groups === undefined) {
		return null;
	}
	return new Date(Number(groups.year), Number(groups.month) - MONTH_OFFSET, Number(groups.day)).getTime();
}

/** Epoch ms → the local `yyyy-MM-dd` it falls on; `""` for no date. */
export function epochMsToDateInput(epochMs: number | null): string {
	if (epochMs === null) {
		return "";
	}
	const date = new Date(epochMs);
	const pad = (part: number): string => String(part).padStart(DATE_PART_WIDTH, "0");
	return `${String(date.getFullYear())}-${pad(date.getMonth() + MONTH_OFFSET)}-${pad(date.getDate())}`;
}

/** `"API, tech-debt ,"` → `["API", "tech-debt"]` (the contract lower-cases and checks them). */
export function labelsFromText(text: string): string[] {
	return text
		.split(LABEL_SEPARATOR)
		.map((label) => label.trim())
		.filter((label) => label.length > 0);
}

/** A picker's `""` → `null` (no parent, unassigned). */
function idOrNull(value: string): string | null {
	return value.length === 0 ? null : value;
}

const DateInputSchema = z.string().transform(dateInputToEpochMs);
const IdInputSchema = z.string().transform(idOrNull);
const LabelsInputSchema = z.string().transform(labelsFromText);

/** The fields both forms hold, as raw input (the parent is chosen at creation, and changed later only by Move to…). */
const FIELD_INPUTS = {
	title: z.string(),
	description: z.string(),
	priority: KanbanTaskPrioritySchema,
	team: KanbanTeamSchema,
	assigneeId: IdInputSchema,
	labels: LabelsInputSchema,
	startAt: DateInputSchema,
	dueAt: DateInputSchema,
	storyPoints: NullableNumberInputSchema,
	progress: RequiredNumberInputSchema,
};

/** Levels that follow their story's dates, so the form hides theirs. */
export function followsStoryDates(type: KanbanItemType): boolean {
	return type === "TASK" || type === "SUBTASK";
}

/**
 * The create form's raw values → `CreateKanbanTaskSchema` (the `POST /admin/kanban/tasks`
 * contract). The fields the chosen type does not carry — and the form therefore
 * hides — are dropped first (an epic's parent, a task's or subtask's dates, a
 * non-story's estimate), so switching the type never leaves a hidden value blocking the form.
 */
export const KanbanTaskFormSchema = contractFormSchema(
	z.object({ columnId: z.string(), type: KanbanItemTypeSchema, parentId: IdInputSchema, ...FIELD_INPUTS }).transform((values) => ({
		...values,
		parentId: KANBAN_PARENT_TYPE[values.type] === null ? null : values.parentId,
		startAt: followsStoryDates(values.type) ? null : values.startAt,
		dueAt: followsStoryDates(values.type) ? null : values.dueAt,
		storyPoints: values.type === "STORY" ? values.storyPoints : null,
	})),
	CreateKanbanTaskSchema,
);

export type KanbanTaskFormValues = z.input<typeof KanbanTaskFormSchema>;

/** One step as the edit form holds it: a stable `key` for React, `id` `""` for a new row. */
export interface KanbanStepRowValues {
	readonly key: string;
	readonly id: string;
	readonly title: string;
	readonly depth: number;
	readonly isDone: boolean;
	readonly assigneeId: string;
}

/** One acceptance criterion as the edit form holds it. */
export interface KanbanCriterionRowValues {
	readonly key: string;
	readonly id: string;
	readonly title: string;
	readonly isDone: boolean;
}

/** A row left blank is a row the person never wrote: dropped, never sent as an empty title. */
function isWritten(row: { readonly title: string }): boolean {
	return row.title.trim().length > 0;
}

const StepRowsInputSchema = z
	.array(z.object({ key: z.string(), id: z.string(), title: z.string(), depth: z.number(), isDone: z.boolean(), assigneeId: z.string() }))
	.transform((rows) =>
		normalizeStepDepths(rows.filter(isWritten)).map(({ id, title, depth, isDone, assigneeId }) => ({
			...(id.length === 0 ? {} : { id }),
			title,
			depth,
			isDone,
			assigneeId: idOrNull(assigneeId),
		})),
	);

const CriterionRowsInputSchema = z
	.array(z.object({ key: z.string(), id: z.string(), title: z.string(), isDone: z.boolean() }))
	.transform((rows) => rows.filter(isWritten).map(({ id, title, isDone }) => ({ ...(id.length === 0 ? {} : { id }), title, isDone })));

/**
 * The edit form's raw values → `UpdateKanbanTaskSchema`. A checklist the item's
 * level does not carry is left out (`undefined`), so the edit never touches it.
 */
export const KanbanTaskEditFormSchema = contractFormSchema(
	z
		.object({
			type: KanbanItemTypeSchema,
			version: z.number(),
			...FIELD_INPUTS,
			steps: StepRowsInputSchema,
			acceptanceCriteria: CriterionRowsInputSchema,
		})
		.transform(({ type, steps, acceptanceCriteria, ...fields }) => ({
			...fields,
			...(followsStoryDates(type) ? { startAt: null, dueAt: null } : {}),
			...(type === "SUBTASK" ? { steps } : {}),
			...(type === "FEATURE" || type === "STORY" ? { acceptanceCriteria } : {}),
		})),
	UpdateKanbanTaskSchema,
);

export type KanbanTaskEditFormValues = z.input<typeof KanbanTaskEditFormSchema>;

/** What a new item starts from. */
export interface KanbanNewItemDefaults {
	readonly columnId: string;
	readonly type: KanbanItemType;
	/** A parent picked before the form opened ("Add story" on a feature's page). */
	readonly parentId?: string | undefined;
}

/** A blank item of `type` in `columnId`. */
export function emptyTaskFormValues({ columnId, type, parentId = "" }: KanbanNewItemDefaults): KanbanTaskFormValues {
	return {
		columnId,
		type,
		parentId,
		title: "",
		description: "",
		priority: "MEDIUM",
		team: "PRODUCT",
		assigneeId: "",
		labels: "",
		startAt: "",
		dueAt: "",
		storyPoints: "",
		progress: "0",
	};
}

/** A new, blank step or criterion row. */
export function newStepRow(depth: number): KanbanStepRowValues {
	return { key: newRowId(), id: "", title: "", depth, isDone: false, assigneeId: "" };
}

export function newCriterionRow(): KanbanCriterionRowValues {
	return { key: newRowId(), id: "", title: "", isDone: false };
}

/** The edit form's starting values: the stored item and its checklists. */
export function toTaskEditFormValues(task: KanbanTaskDetail): KanbanTaskEditFormValues {
	return {
		type: task.type,
		version: task.version,
		title: task.title,
		description: task.description,
		priority: task.priority,
		team: task.team,
		assigneeId: task.assignee?.id ?? "",
		labels: task.labels.join(", "),
		startAt: epochMsToDateInput(task.startAt),
		dueAt: epochMsToDateInput(task.dueAt),
		storyPoints: task.storyPoints === null ? "" : String(task.storyPoints),
		progress: String(task.progress),
		steps: task.stepItems.map((row) => ({ key: row.id, id: row.id, title: row.title, depth: row.depth, isDone: row.isDone, assigneeId: row.assignee?.id ?? "" })),
		acceptanceCriteria: task.acceptanceCriterionItems.map((row) => ({ key: row.id, id: row.id, title: row.title, isDone: row.isDone })),
	};
}

/** A ready-made starting point for a new item ("Add from template"). */
export interface KanbanTaskTemplate {
	readonly key: string;
	readonly label: string;
	readonly title: string;
	readonly description: string;
	readonly priority: KanbanTaskPriority;
	readonly team: KanbanTeam;
}

export const KANBAN_TASK_TEMPLATES: readonly KanbanTaskTemplate[] = [
	{
		key: "bug",
		label: "Bug report",
		title: "Fix: ",
		description: "What happens, what should happen, and the steps that reproduce it.",
		priority: "HIGH",
		team: "QA",
	},
	{
		key: "feature",
		label: "User story",
		title: "As a … I want … so that …",
		description: "The problem it solves, who it is for, and how we will know it works.",
		priority: "MEDIUM",
		team: "PRODUCT",
	},
	{ key: "chore", label: "Chore", title: "", description: "The maintenance to do and why it matters now.", priority: "LOW", team: "PLATFORM" },
	{
		key: "security",
		label: "Security review",
		title: "Review: ",
		description: "The surface to review, the threats to rule out, and the evidence to keep.",
		priority: "HIGH",
		team: "SECURITY",
	},
];

/** A template's values for a new item. */
export function templateFormValues(template: KanbanTaskTemplate, defaults: KanbanNewItemDefaults): KanbanTaskFormValues {
	return { ...emptyTaskFormValues(defaults), title: template.title, description: template.description, priority: template.priority, team: template.team };
}

/**
 * A step tree kept valid while it is edited: each row at most one level below
 * the row above it (the first row a sub-subtask), never deeper than the deepest
 * level — so outdenting a row pulls its children up with it.
 */
export function normalizeStepDepths(rows: readonly KanbanStepRowValues[]): KanbanStepRowValues[] {
	let previousDepth = -1;
	return rows.map((row): KanbanStepRowValues => {
		const depth = Math.max(0, Math.min(row.depth, previousDepth + 1, KANBAN_STEP_MAX_DEPTH));
		previousDepth = depth;
		return depth === row.depth ? row : { ...row, depth };
	});
}

/** `rows` with the row at `index` moved one place up (`-1`) or down (`1`); unchanged at either end. */
export function moveRow<T>(rows: readonly T[], index: number, step: -1 | 1): T[] {
	const target = index + step;
	const row = rows.at(index);
	if (row === undefined || target < 0 || target >= rows.length) {
		return [...rows];
	}
	const next = rows.filter((_, position) => position !== index);
	next.splice(target, 0, row);
	return next;
}
