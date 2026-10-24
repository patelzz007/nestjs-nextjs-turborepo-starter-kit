// ============================================
// contexts/kanban/lib/kanban-display.ts - how the board names and colours things
// ============================================
// The board's domain knowledge for the UI, kept out of the kit's primitives:
// labels, the badge each priority and team wears, the tone a person's avatar
// takes, and the card's date and count wording. Colours come from the kit's
// tone palette (packages/tokens), never raw Tailwind hues, so both themes keep
// AA contrast.

import {
	KANBAN_CHILD_TYPE,
	KanbanActivityFieldSchema,
	KanbanLinkKindSchema,
	KanbanTaskPrioritySchema,
	KanbanTeamSchema,
	LIST_SLOT_INDEX,
	type KanbanActivity,
	type KanbanActivityField,
	type KanbanAncestor,
	type KanbanBoardKind,
	type KanbanColumnStatus,
	type KanbanItemType,
	type KanbanLinkKind,
	type KanbanPlanningStage,
	type KanbanTask,
	type KanbanTaskCounts,
	type KanbanTaskPriority,
	type KanbanTeam,
	type KanbanWorkState,
} from "@workspace/shared";
import type { BadgeVariant } from "@workspace/ui/components/badge";
import { ArrowUpRight, BookOpen, FileText, Flame, Layers, ListTree, MessageSquare, Minus, Paperclip, Puzzle, SquareCheck, type LucideIcon } from "lucide-react";

/** The categorical tones a team or a person is drawn in. */
export type KanbanTone = Extract<BadgeVariant, "blue" | "green" | "violet" | "teal" | "orange" | "red" | "yellow">;

/** Every tone, in the order owners are assigned them. */
export const KANBAN_TONES: readonly KanbanTone[] = ["blue", "green", "violet", "teal", "orange", "red", "yellow"];

export interface KanbanPriorityDisplay {
	readonly label: string;
	readonly icon: LucideIcon;
	readonly variant: BadgeVariant;
}

export const KANBAN_PRIORITY_DISPLAY: Readonly<Record<KanbanTaskPriority, KanbanPriorityDisplay>> = {
	HIGH: { label: "High", icon: Flame, variant: "destructive" },
	MEDIUM: { label: "Medium", icon: ArrowUpRight, variant: "yellow" },
	LOW: { label: "Low", icon: Minus, variant: "secondary" },
};

/** The tone a priority's bare icon takes where only the icon is shown (a card, a tree row). */
export const KANBAN_PRIORITY_ICON_CLASS: Readonly<Record<KanbanTaskPriority, string>> = {
	HIGH: "text-tone-red",
	MEDIUM: "text-tone-orange",
	LOW: "text-tone-blue",
};

/** Highest first: the order a priority sort shows. */
export const KANBAN_PRIORITY_RANK: Readonly<Record<KanbanTaskPriority, number>> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export interface KanbanTeamDisplay {
	readonly label: string;
	readonly tone: KanbanTone;
}

export const KANBAN_TEAM_DISPLAY: Readonly<Record<KanbanTeam, KanbanTeamDisplay>> = {
	BACKEND: { label: "Backend", tone: "blue" },
	DATA: { label: "Data", tone: "green" },
	DESIGN: { label: "Design", tone: "violet" },
	PLATFORM: { label: "Platform", tone: "teal" },
	PRODUCT: { label: "Product", tone: "orange" },
	QA: { label: "QA", tone: "red" },
	SECURITY: { label: "Security", tone: "yellow" },
};

/** What each planning stage is called, whatever a column titled after it is named. */
export const KANBAN_PLANNING_STAGE_LABEL: Readonly<Record<KanbanPlanningStage, string>> = {
	BACKLOG: "Backlog",
	REFINING: "Refining",
	READY: "Ready",
	PLANNED: "Planned",
	DELIVERED: "Delivered",
};

/** What each work state is called, whatever a column titled after it is named. */
export const KANBAN_WORK_STATE_LABEL: Readonly<Record<KanbanWorkState, string>> = {
	TODO: "To do",
	IN_PROGRESS: "In progress",
	REVIEW: "In review",
	DONE: "Done",
};

/** A column's stage or state as a person reads it (`"Delivered"`, `"In review"`). */
export function columnStatusLabel(column: KanbanColumnStatus): string {
	return column.board === "PLANNING" ? KANBAN_PLANNING_STAGE_LABEL[column.stage] : KANBAN_WORK_STATE_LABEL[column.state];
}

/** True for an execution column whose cards are being worked on (the card shows its progress). */
export function columnIsInProgress(column: KanbanColumnStatus): boolean {
	return column.board === "EXECUTION" && column.state === "IN_PROGRESS";
}

/** An avatar fallback drawn in a tone: soft fill, AA text (the classes are literal so Tailwind sees them). */
export const KANBAN_AVATAR_TONE_CLASS: Readonly<Record<KanbanTone, string>> = {
	blue: "[&_[data-slot=avatar-fallback]]:bg-tone-blue-soft [&_[data-slot=avatar-fallback]]:text-tone-blue",
	green: "[&_[data-slot=avatar-fallback]]:bg-tone-green-soft [&_[data-slot=avatar-fallback]]:text-tone-green",
	violet: "[&_[data-slot=avatar-fallback]]:bg-tone-violet-soft [&_[data-slot=avatar-fallback]]:text-tone-violet",
	teal: "[&_[data-slot=avatar-fallback]]:bg-tone-teal-soft [&_[data-slot=avatar-fallback]]:text-tone-teal",
	orange: "[&_[data-slot=avatar-fallback]]:bg-tone-orange-soft [&_[data-slot=avatar-fallback]]:text-tone-orange",
	red: "[&_[data-slot=avatar-fallback]]:bg-tone-red-soft [&_[data-slot=avatar-fallback]]:text-tone-red",
	yellow: "[&_[data-slot=avatar-fallback]]:bg-tone-yellow-soft [&_[data-slot=avatar-fallback]]:text-tone-yellow",
};

/** The tone a person keeps everywhere on the board: derived from their id, so it never changes between visits. */
export function toneForPerson(personId: string): KanbanTone {
	let sum = 0;
	for (const character of personId) {
		sum += character.charCodeAt(LIST_SLOT_INDEX.first);
	}
	return KANBAN_TONES.at(sum % KANBAN_TONES.length) ?? "blue";
}

/** Up to two initials of a person's name (`"Admin User"` → `"AU"`). */
export function initialsOf(name: string): string {
	return name
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.slice(0, 2)
		.map((word) => word.charAt(LIST_SLOT_INDEX.first).toUpperCase())
		.join("");
}

const DUE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** The card's due date (`"Jun 14"`), in the viewer's time zone. */
export function formatDueDate(dueAt: number | null): string {
	return dueAt === null ? "No due date" : DUE_DATE_FORMAT.format(new Date(dueAt));
}

/** `"1 item"` / `"3 items"`. */
export function itemCountLabel(count: number): string {
	return `${String(count)} ${count === 1 ? "item" : "items"}`;
}

export interface KanbanInsightDisplay {
	readonly key: keyof KanbanTaskCounts;
	readonly label: string;
	readonly icon: LucideIcon;
}

/** The card footer's counts, in the order they are shown. */
export const KANBAN_INSIGHTS: readonly KanbanInsightDisplay[] = [
	{ key: "attachments", label: "Attachments", icon: Paperclip },
	{ key: "comments", label: "Comments", icon: MessageSquare },
	{ key: "documents", label: "Documents", icon: FileText },
];

/** The counts a card shows: only those above zero, so a quiet card stays quiet. */
export function visibleInsights(counts: KanbanTaskCounts): readonly KanbanInsightDisplay[] {
	return KANBAN_INSIGHTS.filter((insight) => counts[insight.key] > 0);
}

// ── The hierarchy ───────────────────────────────────────────────────────────

export interface KanbanTypeDisplay {
	readonly label: string;
	readonly plural: string;
	readonly icon: LucideIcon;
	readonly tone: KanbanTone;
}

/** Each level's name, icon and tone: the card's type badge, the breadcrumb, the pickers. */
export const KANBAN_TYPE_DISPLAY: Readonly<Record<KanbanItemType, KanbanTypeDisplay>> = {
	EPIC: { label: "Epic", plural: "Epics", icon: Layers, tone: "violet" },
	FEATURE: { label: "Feature", plural: "Features", icon: Puzzle, tone: "blue" },
	STORY: { label: "Story", plural: "Stories", icon: BookOpen, tone: "green" },
	TASK: { label: "Task", plural: "Tasks", icon: SquareCheck, tone: "teal" },
	SUBTASK: { label: "Subtask", plural: "Subtasks", icon: ListTree, tone: "orange" },
};

/** A level's icon tile: soft fill, AA icon (literal classes, so Tailwind sees them). */
export const KANBAN_TYPE_ICON_CLASS: Readonly<Record<KanbanItemType, string>> = {
	EPIC: "bg-tone-violet-soft text-tone-violet",
	FEATURE: "bg-tone-blue-soft text-tone-blue",
	STORY: "bg-tone-green-soft text-tone-green",
	TASK: "bg-tone-teal-soft text-tone-teal",
	SUBTASK: "bg-tone-orange-soft text-tone-orange",
};

/** A level's name as the card's chip spells it: the level's tone on its soft fill (the pairs keep 4.5:1 in both themes). */
export const KANBAN_LEVEL_CHIP_CLASS: Readonly<Record<KanbanItemType, string>> = {
	EPIC: "bg-tone-violet-soft text-tone-violet",
	FEATURE: "bg-tone-blue-soft text-tone-blue",
	STORY: "bg-tone-green-soft text-tone-green",
	TASK: "bg-tone-teal-soft text-tone-teal",
	SUBTASK: "bg-tone-orange-soft text-tone-orange",
};

/** What opens below an item: how many child items (or, for a subtask, steps) and what they are called. */
export interface KanbanChildCount {
	readonly count: number;
	readonly label: string;
}

/** `{ 3, "3 tasks" }` for a story with three tasks, `{ 2, "2 steps" }` for a subtask; `null` when nothing sits below it. */
export function childCountOf(task: Pick<KanbanTask, "type" | "rollup" | "steps">): KanbanChildCount | null {
	if (task.type === "SUBTASK") {
		const count = task.steps.total;
		return count === 0 ? null : { count, label: `${String(count)} ${count === 1 ? "step" : "steps"}` };
	}
	const childType = KANBAN_CHILD_TYPE[task.type];
	const count = task.rollup.children.total;
	if (childType === null || count === 0) {
		return null;
	}
	const display = KANBAN_TYPE_DISPLAY[childType];
	return { count, label: `${String(count)} ${(count === 1 ? display.label : display.plural).toLowerCase()}` };
}

export interface KanbanBoardDisplay {
	readonly label: string;
	readonly description: string;
}

export const KANBAN_BOARD_DISPLAY: Readonly<Record<KanbanBoardKind, KanbanBoardDisplay>> = {
	PLANNING: { label: "Planning", description: "Epics and features, their dates and rolled-up points" },
	EXECUTION: { label: "Execution", description: "Stories, their tasks and subtasks, day to day" },
};

/** What a step is called at each depth of a subtask's breakdown (levels 6 and 7 of the hierarchy). */
export const KANBAN_STEP_DEPTH_LABEL: readonly string[] = ["Sub-subtask", "Sub-sub-subtask"];

export const KANBAN_LINK_KIND_LABEL: Readonly<Record<KanbanLinkKind, string>> = {
	BLOCKS: "Blocks",
	BLOCKED_BY: "Blocked by",
	RELATES_TO: "Relates to",
};

/** `"5 pts"` / `"1 pt"`. */
export function pointsLabel(points: number): string {
	return `${String(points)} ${points === 1 ? "pt" : "pts"}`;
}

/** Whole percent of `done` out of `total` (0 when there is nothing to count). */
export function percentOf(done: number, total: number): number {
	return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** An item's dates: its own, or — for a task or subtask — its story's, which it follows. */
export interface KanbanSchedule {
	readonly startAt: number | null;
	readonly dueAt: number | null;
	/** The story the dates come from, when the item inherits them. */
	readonly inheritedFrom: KanbanAncestor | null;
}

export function effectiveSchedule(task: Pick<KanbanTask, "type" | "startAt" | "dueAt" | "ancestors">): KanbanSchedule {
	if (task.type !== "TASK" && task.type !== "SUBTASK") {
		return { startAt: task.startAt, dueAt: task.dueAt, inheritedFrom: null };
	}
	const story = task.ancestors.find((ancestor) => ancestor.type === "STORY") ?? null;
	return { startAt: story?.startAt ?? null, dueAt: story?.dueAt ?? null, inheritedFrom: story };
}

/** `"Jun 2 – Jun 14"`, `"Due Jun 14"`, `"From Jun 2"` or `"No dates"`. */
export function formatDateRange(startAt: number | null, dueAt: number | null): string {
	if (startAt !== null && dueAt !== null) {
		return `${DUE_DATE_FORMAT.format(new Date(startAt))} – ${DUE_DATE_FORMAT.format(new Date(dueAt))}`;
	}
	if (dueAt !== null) {
		return `Due ${DUE_DATE_FORMAT.format(new Date(dueAt))}`;
	}
	return startAt === null ? "No dates" : `From ${DUE_DATE_FORMAT.format(new Date(startAt))}`;
}

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const DAYS_PER_WEEK = 7;
/** Calendar months and years vary; for "how long ago" an average one is close enough. */
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

/** Each unit and how many milliseconds it spans, largest first: the coarsest one that fits is used. */
const RELATIVE_TIME_UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
	["year", DAYS_PER_YEAR * MS_PER_DAY],
	["month", DAYS_PER_MONTH * MS_PER_DAY],
	["week", DAYS_PER_WEEK * MS_PER_DAY],
	["day", MS_PER_DAY],
	["hour", MS_PER_HOUR],
	["minute", MS_PER_MINUTE],
];

/** When something happened, from `now`: `"3 hours ago"`, `"yesterday"`, `"now"` under a minute. */
export function formatRelativeTime(at: number, now: number): string {
	const elapsed = at - now;
	for (const [unit, span] of RELATIVE_TIME_UNITS) {
		if (Math.abs(elapsed) >= span) {
			return RELATIVE_TIME_FORMAT.format(Math.round(elapsed / span), unit);
		}
	}
	return "now";
}

/** True when the item is due before today and not done. */
export function isOverdue(dueAt: number | null, isDone: boolean, now: number): boolean {
	return dueAt !== null && !isDone && dueAt < now;
}

const FIELD_LABEL: Readonly<Record<KanbanActivityField, string>> = {
	TITLE: "the title",
	DESCRIPTION: "the description",
	PRIORITY: "the priority",
	TEAM: "the team",
	START: "the start date",
	DUE: "the due date",
	STORY_POINTS: "the estimate",
	PROGRESS: "the progress",
	ASSIGNEE: "the assignee",
	PARENT: "the parent",
	LABELS: "the labels",
	SUBTASKS: "the subtasks",
	STEPS: "the steps",
	ACCEPTANCE_CRITERIA: "the acceptance criteria",
};

/** A value an activity row kept, as a person reads it for its field. */
function activityValue(field: KanbanActivityField, value: string | null): string {
	if (value === null) {
		return "none";
	}
	switch (field) {
		case "PRIORITY": {
			const priority = KanbanTaskPrioritySchema.safeParse(value);
			return priority.success ? KANBAN_PRIORITY_DISPLAY[priority.data].label : value;
		}
		case "TEAM": {
			const team = KanbanTeamSchema.safeParse(value);
			return team.success ? KANBAN_TEAM_DISPLAY[team.data].label : value;
		}
		case "START":
		case "DUE":
			return Number.isFinite(Number(value)) ? DUE_DATE_FORMAT.format(new Date(Number(value))) : value;
		case "STORY_POINTS":
			return pointsLabel(Number(value));
		case "PROGRESS":
			return `${value}%`;
		case "SUBTASKS":
		case "STEPS":
		case "ACCEPTANCE_CRITERIA":
			return `${value} ${value === "1" ? "row" : "rows"}`;
		case "TITLE":
		case "DESCRIPTION":
		case "ASSIGNEE":
		case "PARENT":
		case "LABELS":
			return value;
	}
}

/** One history entry as a sentence after its actor's name ("moved this from To Do to Review"). */
export function describeActivity(entry: Pick<KanbanActivity, "kind" | "field" | "from" | "to">): string {
	const to = entry.to ?? "";
	switch (entry.kind) {
		case "CREATED":
			return entry.to === null ? "created this" : `created this in ${to}`;
		case "MOVED":
			return `moved this from ${entry.from ?? "another column"} to ${to}`;
		case "COMMENTED":
			return "commented";
		case "ATTACHED":
			return `attached ${to}`;
		case "DETACHED":
			return `removed the attachment ${to}`;
		case "LINKED": {
			const kind = KanbanLinkKindSchema.safeParse(entry.from);
			return `linked this as ${kind.success ? KANBAN_LINK_KIND_LABEL[kind.data].toLowerCase() : "related to"} ${to}`;
		}
		case "UNLINKED":
			return `removed the link to ${entry.to ?? "an item"}`;
		case "CHECKED":
			return `ticked off “${to}”`;
		case "UNCHECKED":
			return `reopened “${to}”`;
		case "UPDATED": {
			const field = KanbanActivityFieldSchema.safeParse(entry.field);
			if (!field.success) {
				return "updated this";
			}
			if (field.data === "DESCRIPTION") {
				return "updated the description";
			}
			return `changed ${FIELD_LABEL[field.data]} from ${activityValue(field.data, entry.from)} to ${activityValue(field.data, entry.to)}`;
		}
	}
}
