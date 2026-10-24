import { z } from "zod";

import { BULK_MUTATION_MAX_ITEMS } from "../../../schemas/api/bulk-mutation";
import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { OptimisticVersionSchema } from "../../catalog/schemas/catalog-fields";
import { DocumentMimeTypeSchema } from "../../files/schemas/storage";

// ── Kanban board contracts ──────────────────────────────────────────────────
//
// ONE definition of every bound. The same numbers size the database columns
// (apps/api/prisma/schema.prisma `@db.VarChar(n)`) and the board's invariants
// (apps/api/src/contexts/kanban/domain), so the API rejects with 400 exactly
// what the database could not store.
//
// Two linked boards hold one hierarchy: EPIC → FEATURE on the PLANNING board,
// STORY → TASK → SUBTASK on the EXECUTION board, each item pointing at its parent
// one level up. The two levels below a subtask (sub-subtask, sub-sub-subtask)
// are the subtask's nested checklist — its steps — not cards.

/** Column headings (`VarChar(60)`). */
export const KANBAN_COLUMN_TITLE_MAX_LENGTH = 60;
/** Item titles (`VarChar(120)`). */
export const KANBAN_TASK_TITLE_MAX_LENGTH = 120;
/** Item descriptions (`VarChar(2000)`). */
export const KANBAN_TASK_DESCRIPTION_MAX_LENGTH = 2_000;
/** Item progress is a percentage. */
export const KANBAN_TASK_PROGRESS_MAX = 100;
/** Comment bodies (`VarChar(2000)`). */
export const KANBAN_COMMENT_BODY_MAX_LENGTH = 2_000;
/** Live items one column may hold — keeps the board one bounded read and every move one bounded rewrite. */
export const KANBAN_COLUMN_TASK_LIMIT = 200;
/** Live files one item may have attached (its comments' files included). */
export const KANBAN_TASK_ATTACHMENT_LIMIT = 20;
/** Files one comment may carry. */
export const KANBAN_COMMENT_FILE_LIMIT = 5;
/** Labels one item may carry. */
export const KANBAN_TASK_LABEL_LIMIT = 8;
/** One label (`VarChar(24)` per array element). */
export const KANBAN_LABEL_MAX_LENGTH = 24;
/** Checklist and acceptance-criterion rows (`VarChar(200)`). */
export const KANBAN_CHECKLIST_TITLE_MAX_LENGTH = 200;
/** Live step rows one subtask may hold. */
export const KANBAN_STEP_LIMIT = 50;
/** Live acceptance criteria one feature or story may hold. */
export const KANBAN_ACCEPTANCE_CRITERIA_LIMIT = 20;
/** Deepest step level: 0 = sub-subtask, 1 = sub-sub-subtask. */
export const KANBAN_STEP_MAX_DEPTH = 1;
/** An item key (`VarChar(24)`): its level and number, `SUBTASK-1234567`. */
export const KANBAN_KEY_MAX_LENGTH = 24;
/** Results one item search answers (the command palette, the Move to… picker). */
export const KANBAN_SEARCH_LIMIT = 20;
/** What an activity row keeps of a value (`VarChar(200)`). */
export const KANBAN_ACTIVITY_VALUE_MAX_LENGTH = 200;

/** The estimation scale: story points are a modified Fibonacci number, so an estimate never pretends to more precision than it has. */
export const KANBAN_STORY_POINT_OPTIONS: readonly [1, 2, 3, 5, 8, 13, 21] = [1, 2, 3, 5, 8, 13, 21];

/** Which of the two linked boards a column belongs to. */
export const KanbanBoardKindSchema = z.enum(["PLANNING", "EXECUTION"]);
export type KanbanBoardKind = z.output<typeof KanbanBoardKindSchema>;

/** An item's level in the hierarchy, top to bottom. */
export const KanbanItemTypeSchema = z.enum(["EPIC", "FEATURE", "STORY", "TASK", "SUBTASK"]);
export type KanbanItemType = z.output<typeof KanbanItemTypeSchema>;

/**
 * What a planning column stands for: an epic or a feature moves from Backlog
 * through Refining and Ready to Planned, and is Delivered when its work ships.
 * Columns are renamed and reordered freely; their stage is what never changes.
 */
export const KanbanPlanningStageSchema = z.enum(["BACKLOG", "REFINING", "READY", "PLANNED", "DELIVERED"]);
export type KanbanPlanningStage = z.output<typeof KanbanPlanningStageSchema>;

/**
 * What an execution column stands for. The card reads it: an `IN_PROGRESS` card
 * shows its progress, a `DONE` card shows it is done (and its story points count
 * as done in its parents' rollups). Renaming a column never changes its state.
 */
export const KanbanWorkStateSchema = z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]);
export type KanbanWorkState = z.output<typeof KanbanWorkStateSchema>;

export const KanbanTaskPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type KanbanTaskPriority = z.output<typeof KanbanTaskPrioritySchema>;

/** The team an item belongs to. */
export const KanbanTeamSchema = z.enum(["BACKEND", "DATA", "DESIGN", "PLATFORM", "PRODUCT", "QA", "SECURITY"]);
export type KanbanTeam = z.output<typeof KanbanTeamSchema>;

/** A PDF is a document; every other accepted file (an image) is an attachment. Decided by the API from the stored type. */
export const KanbanAttachmentKindSchema = z.enum(["ATTACHMENT", "DOCUMENT"]);
export type KanbanAttachmentKind = z.output<typeof KanbanAttachmentKindSchema>;

/** A link as one item sees it: it blocks the other, is blocked by it, or relates to it. */
export const KanbanLinkKindSchema = z.enum(["BLOCKS", "BLOCKED_BY", "RELATES_TO"]);
export type KanbanLinkKind = z.output<typeof KanbanLinkKindSchema>;

/** What an activity row records. */
export const KanbanActivityKindSchema = z.enum(["CREATED", "UPDATED", "MOVED", "COMMENTED", "ATTACHED", "DETACHED", "LINKED", "UNLINKED", "CHECKED", "UNCHECKED"]);
export type KanbanActivityKind = z.output<typeof KanbanActivityKindSchema>;

/**
 * The field an `UPDATED` activity row changed. `SUBTASKS` is kept for history
 * written before subtasks became items (a task's checklist then): history is
 * append-only, so those rows still read; nothing writes it any more.
 */
export const KanbanActivityFieldSchema = z.enum([
	"TITLE",
	"DESCRIPTION",
	"PRIORITY",
	"TEAM",
	"START",
	"DUE",
	"STORY_POINTS",
	"PROGRESS",
	"ASSIGNEE",
	"PARENT",
	"LABELS",
	"SUBTASKS",
	"STEPS",
	"ACCEPTANCE_CRITERIA",
]);
export type KanbanActivityField = z.output<typeof KanbanActivityFieldSchema>;

// ── The hierarchy's rules (the API enforces them; the forms show them) ──────

/** The board each level lives on. */
export const KANBAN_BOARD_OF_TYPE: Readonly<Record<KanbanItemType, KanbanBoardKind>> = {
	EPIC: "PLANNING",
	FEATURE: "PLANNING",
	STORY: "EXECUTION",
	TASK: "EXECUTION",
	SUBTASK: "EXECUTION",
};

/** The level an item's parent must be (`null`: it never has one). */
export const KANBAN_PARENT_TYPE: Readonly<Record<KanbanItemType, KanbanItemType | null>> = {
	EPIC: null,
	FEATURE: "EPIC",
	STORY: "FEATURE",
	TASK: "STORY",
	SUBTASK: "TASK",
};

/** The levels an item's children are. */
export const KANBAN_CHILD_TYPE: Readonly<Record<KanbanItemType, KanbanItemType | null>> = {
	EPIC: "FEATURE",
	FEATURE: "STORY",
	STORY: "TASK",
	TASK: "SUBTASK",
	SUBTASK: null,
};

/** How a board is split into swimlanes: not at all, or by the epic, feature or story each card sits under. */
export const KanbanGroupBySchema = z.enum(["none", "epic", "feature", "story"]);
export type KanbanGroupBy = z.output<typeof KanbanGroupBySchema>;

/** The levels whose items count toward an execution column's WIP limit: a subtask is part of its task's work, never extra. */
export const KANBAN_WIP_TYPES: readonly KanbanItemType[] = ["STORY", "TASK"];

// ── Keys: every item is named by its level and a number (`STORY-142`) ───────

/** An item key as a person types it (any case, spaces around it): upper-cased, a level and a number. */
export const KanbanItemKeySchema = z
	.string()
	.trim()
	.toUpperCase()
	.pipe(
		z
			.string()
			.max(KANBAN_KEY_MAX_LENGTH)
			.regex(/^(?:EPIC|FEATURE|STORY|TASK|SUBTASK)-[1-9][0-9]*$/u, "A key is a level and a number, like STORY-142"),
	);

/** `kanbanItemKey("STORY", 142)` → `"STORY-142"`: the key a counter's number gives an item of that level. */
export function kanbanItemKey(type: KanbanItemType, keyNumber: number): string {
	return `${type}-${String(keyNumber)}`;
}

// ── Columns: a planning column has a stage, an execution column a state ─────

/** What a column stands for, by board: the fields {@link kanbanColumnIsDone} and the status badges read. */
export type KanbanColumnStatus = { readonly board: "PLANNING"; readonly stage: KanbanPlanningStage } | { readonly board: "EXECUTION"; readonly state: KanbanWorkState };

/** True for the column a finished item sits in: a delivered epic or feature, a done story, task or subtask. */
export function kanbanColumnIsDone(column: KanbanColumnStatus): boolean {
	return column.board === "PLANNING" ? column.stage === "DELIVERED" : column.state === "DONE";
}

/** The item types a board shows, top level first. */
export function kanbanTypesOnBoard(board: KanbanBoardKind): readonly KanbanItemType[] {
	return KanbanItemTypeSchema.options.filter((type) => KANBAN_BOARD_OF_TYPE[type] === board);
}

/** The fields the hierarchy's rules read, as they stand after a create or an edit. */
export interface KanbanItemRuleFields {
	readonly type: KanbanItemType;
	readonly parentId: string | null;
	readonly startAt: number | null;
	readonly dueAt: number | null;
	readonly storyPoints: number | null;
	readonly stepCount: number;
	readonly acceptanceCriterionCount: number;
}

/** One broken rule: the field it concerns and the sentence a person reads. */
export interface KanbanItemRuleIssue {
	readonly field: "parentId" | "startAt" | "dueAt" | "storyPoints" | "steps" | "acceptanceCriteria";
	readonly message: string;
}

/** The levels that follow their story's dates instead of having their own. */
const DATELESS_TYPES: ReadonlySet<KanbanItemType> = new Set<KanbanItemType>(["TASK", "SUBTASK"]);

/**
 * Every hierarchy rule an item breaks: a task belongs to a story, a subtask to a
 * task and an epic to nobody; only stories are estimated (their parents show the
 * sum); tasks and subtasks follow their story's dates; only a subtask is broken
 * into steps, and only features and stories carry acceptance criteria; a start
 * never follows the due date.
 */
export function kanbanItemRuleIssues(fields: KanbanItemRuleFields): readonly KanbanItemRuleIssue[] {
	const issues: KanbanItemRuleIssue[] = [];
	if (KANBAN_PARENT_TYPE[fields.type] === null && fields.parentId !== null) {
		issues.push({ field: "parentId", message: "An epic is the top level: it has no parent." });
	}
	if (fields.type === "TASK" && fields.parentId === null) {
		issues.push({ field: "parentId", message: "A task belongs to a story: choose its story." });
	}
	if (fields.type === "SUBTASK" && fields.parentId === null) {
		issues.push({ field: "parentId", message: "A subtask belongs to a task: choose its task." });
	}
	if (fields.type !== "STORY" && fields.storyPoints !== null) {
		issues.push({ field: "storyPoints", message: "Only stories are estimated; epics and features add up their stories' points." });
	}
	if (DATELESS_TYPES.has(fields.type) && (fields.startAt !== null || fields.dueAt !== null)) {
		issues.push({ field: "dueAt", message: "Tasks and subtasks follow their story's dates; set them on the story." });
	}
	if (fields.startAt !== null && fields.dueAt !== null && fields.startAt > fields.dueAt) {
		issues.push({ field: "dueAt", message: "The due date comes before the start date." });
	}
	if (fields.type !== "SUBTASK" && fields.stepCount > 0) {
		issues.push({ field: "steps", message: "Only a subtask is broken down into steps." });
	}
	if (fields.type !== "FEATURE" && fields.type !== "STORY" && fields.acceptanceCriterionCount > 0) {
		issues.push({ field: "acceptanceCriteria", message: "Only features and stories carry acceptance criteria." });
	}
	return issues;
}

const KanbanTaskTitleSchema = z.string().trim().pipe(z.string().min(1).max(KANBAN_TASK_TITLE_MAX_LENGTH));
const KanbanTaskDescriptionSchema = z.string().trim().max(KANBAN_TASK_DESCRIPTION_MAX_LENGTH);
const KanbanTaskProgressSchema = z.number().int().min(0).max(KANBAN_TASK_PROGRESS_MAX);
/** A comment's text: blank only when the comment carries files. */
const KanbanCommentBodySchema = z.string().trim().max(KANBAN_COMMENT_BODY_MAX_LENGTH);
const KanbanChecklistTitleSchema = z.string().trim().pipe(z.string().min(1).max(KANBAN_CHECKLIST_TITLE_MAX_LENGTH));

/** One story-point estimate on the scale. */
export const KanbanStoryPointsSchema = z.literal(KANBAN_STORY_POINT_OPTIONS);
export type KanbanStoryPoints = z.output<typeof KanbanStoryPointsSchema>;

/** A label: lower-case words joined by hyphens (`"tech-debt"`), so the same label is never spelled two ways. */
export const KanbanLabelSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(
		z
			.string()
			.min(1)
			.max(KANBAN_LABEL_MAX_LENGTH)
			.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lower-case letters, digits and single hyphens"),
	);

/** An item's labels: each once, at most `KANBAN_TASK_LABEL_LIMIT`. */
export const KanbanLabelsSchema = z
	.array(KanbanLabelSchema)
	.max(KANBAN_TASK_LABEL_LIMIT)
	.refine((labels) => new Set(labels).size === labels.length, "Each label once");

/** A step's depth: 0 = sub-subtask, 1 = sub-sub-subtask. */
const KanbanStepDepthSchema = z.number().int().min(0).max(KANBAN_STEP_MAX_DEPTH);

// ── Responses (open: unknown keys are stripped, never rejected — ADR 022) ────

/** A person on the board: a reporter, an assignee, a watcher, a comment's author, an uploader. */
export const KanbanPersonSchema = z.object({
	id: z.uuid(),
	name: z.string(),
});
export type KanbanPerson = z.output<typeof KanbanPersonSchema>;

/** The item's key (`STORY-142`); null only on an item the one-off conversion has not keyed yet. */
const ITEM_KEY = z.string().nullable().meta({ description: "The item's key (`STORY-142`), or null before the conversion keys it", example: "STORY-142" });

/** An item named from another one (its parent chain, a link, a child). */
export const KanbanItemRefSchema = z.object({
	id: z.uuid(),
	key: ITEM_KEY,
	type: KanbanItemTypeSchema,
	title: z.string(),
});
export type KanbanItemRef = z.output<typeof KanbanItemRefSchema>;

/** One of an item's ancestors, with the dates a task inherits from its story. */
export const KanbanAncestorSchema = KanbanItemRefSchema.extend({
	startAt: EpochMsSchema.nullable(),
	dueAt: EpochMsSchema.nullable(),
});
export type KanbanAncestor = z.output<typeof KanbanAncestorSchema>;

/** What a card's footer counts: live comments, image attachments and PDF documents. */
export const KanbanTaskCountsSchema = z.object({
	comments: z.number().int().nonnegative(),
	attachments: z.number().int().nonnegative(),
	documents: z.number().int().nonnegative(),
});
export type KanbanTaskCounts = z.output<typeof KanbanTaskCountsSchema>;

/** How far a list of steps has got: rows ticked off out of all of them. */
export const KanbanTallySchema = z.object({
	done: z.number().int().nonnegative(),
	total: z.number().int().nonnegative(),
});
export type KanbanTally = z.output<typeof KanbanTallySchema>;

/**
 * What an item adds up from below: its direct children (and how many sit in a
 * done column — a task's subtasks among them) and the story points of every
 * story under it — or its own, for a story — and how many of those points are done.
 */
export const KanbanRollupSchema = z.object({
	children: KanbanTallySchema,
	points: KanbanTallySchema,
});
export type KanbanRollup = z.output<typeof KanbanRollupSchema>;

export const KanbanTaskSchema = z
	.object({
		id: z.uuid(),
		key: ITEM_KEY,
		/** The column the item sits in, on the board its level lives on. */
		columnId: z.uuid(),
		type: KanbanItemTypeSchema,
		title: z.string(),
		description: z.string(),
		priority: KanbanTaskPrioritySchema,
		team: KanbanTeamSchema,
		labels: z.array(z.string()),
		parentId: z.uuid().nullable(),
		/** The item's parent chain, the top level first (for a subtask: epic, feature, story, task). */
		ancestors: z.array(KanbanAncestorSchema),
		startAt: EpochMsSchema.nullable().meta({ description: "Epoch milliseconds the item starts, or null (a task or subtask inherits its story's)", example: 1792900000000 }),
		dueAt: EpochMsSchema.nullable().meta({ description: "Epoch milliseconds the item is due, or null (a task or subtask inherits its story's)", example: 1793500000000 }),
		storyPoints: z.number().int().nullable().meta({ description: "A story's estimate, or null (epics and features show `rollup.points`)", example: 5 }),
		progress: z.number().int().min(0).max(KANBAN_TASK_PROGRESS_MAX),
		/** The reporter: who created the item. */
		owner: KanbanPersonSchema,
		assignee: KanbanPersonSchema.nullable(),
		rollup: KanbanRollupSchema,
		/** A subtask's steps ticked off (zero for every other level). */
		steps: KanbanTallySchema,
		acceptanceCriteria: KanbanTallySchema,
		/** Another live item that is not done yet blocks this one. */
		isBlocked: z.boolean(),
		counts: KanbanTaskCountsSchema,
		version: z.number().int().nonnegative().meta({ description: "Optimistic-lock token: send it back with an edit or a move", example: 3 }),
		createdAt: EpochMsSchema,
		updatedAt: EpochMsSchema,
	})
	.meta({ description: "An item card. Response schema: unknown keys are stripped, never rejected (ADR 022)." });
export type KanbanTask = z.output<typeof KanbanTaskSchema>;

const COLUMN_VERSION = z.number().int().nonnegative().meta({ description: "Optimistic-lock token: send it back with a column move or edit", example: 1 });

/** A planning column: epics and features in one stage. Planning has no WIP limit. */
export const KanbanPlanningColumnSchema = z.object({
	id: z.uuid(),
	board: z.literal("PLANNING"),
	title: z.string(),
	stage: KanbanPlanningStageSchema,
	version: COLUMN_VERSION,
	/** The column's live items, top to bottom. */
	tasks: z.array(KanbanTaskSchema),
});
export type KanbanPlanningColumn = z.output<typeof KanbanPlanningColumnSchema>;

/** An execution column: stories, tasks and subtasks in one work state, with a soft WIP limit on stories and tasks. */
export const KanbanExecutionColumnSchema = z.object({
	id: z.uuid(),
	board: z.literal("EXECUTION"),
	title: z.string(),
	state: KanbanWorkStateSchema,
	wipLimit: z
		.number()
		.int()
		.positive()
		.nullable()
		.meta({ description: "Soft work-in-progress limit on stories and tasks (subtasks never count), or null for none", example: 4 }),
	version: COLUMN_VERSION,
	/** The column's live items, top to bottom. */
	tasks: z.array(KanbanTaskSchema),
});
export type KanbanExecutionColumn = z.output<typeof KanbanExecutionColumnSchema>;

export const KanbanColumnSchema = z.discriminatedUnion("board", [KanbanPlanningColumnSchema, KanbanExecutionColumnSchema]);
export type KanbanColumn = z.output<typeof KanbanColumnSchema>;

/** `GET /admin/kanban/board?board=…` — one board's columns, left to right, each with its items in order. */
export const KanbanBoardSchema = z.object({
	board: KanbanBoardKindSchema,
	columns: z.array(KanbanColumnSchema),
});
export type KanbanBoard = z.output<typeof KanbanBoardSchema>;

export const KanbanAttachmentSchema = z.object({
	id: z.uuid(),
	fileId: z.uuid(),
	/** The comment the file was posted with, or null when it was attached to the item directly. */
	commentId: z.uuid().nullable(),
	kind: KanbanAttachmentKindSchema,
	fileName: z.string(),
	mimeType: DocumentMimeTypeSchema,
	sizeBytes: z.number().int().nonnegative(),
	uploadedBy: KanbanPersonSchema,
	createdAt: EpochMsSchema,
});
export type KanbanAttachment = z.output<typeof KanbanAttachmentSchema>;

/** The column an item sits in, as other items and its page name it. */
export const KanbanColumnSummarySchema = z.discriminatedUnion("board", [
	KanbanPlanningColumnSchema.pick({ id: true, board: true, title: true, stage: true }),
	KanbanExecutionColumnSchema.pick({ id: true, board: true, title: true, state: true }),
]);
export type KanbanColumnSummary = z.output<typeof KanbanColumnSummarySchema>;

/** An item as a list row: a child, a linked item, a picker option. */
export const KanbanItemSummarySchema = KanbanItemRefSchema.extend({
	priority: KanbanTaskPrioritySchema,
	storyPoints: z.number().int().nullable(),
	assignee: KanbanPersonSchema.nullable(),
	column: KanbanColumnSummarySchema,
});
export type KanbanItemSummary = z.output<typeof KanbanItemSummarySchema>;

/** One link, from the item's point of view. */
export const KanbanLinkSchema = z.object({
	id: z.uuid(),
	kind: KanbanLinkKindSchema,
	item: KanbanItemSummarySchema,
});
export type KanbanLink = z.output<typeof KanbanLinkSchema>;

/** One step of a subtask's breakdown: depth 0 is a sub-subtask, 1 a sub-sub-subtask. */
export const KanbanStepSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	depth: z.number().int().min(0).max(KANBAN_STEP_MAX_DEPTH),
	isDone: z.boolean(),
	assignee: KanbanPersonSchema.nullable(),
});
export type KanbanStep = z.output<typeof KanbanStepSchema>;

export const KanbanAcceptanceCriterionSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	isDone: z.boolean(),
});
export type KanbanAcceptanceCriterion = z.output<typeof KanbanAcceptanceCriterionSchema>;

/**
 * `GET /admin/kanban/tasks/:taskId` — the card plus its column, its children,
 * its links, its checklists, who watches it (and whether the caller does) and
 * its attachments (newest first).
 */
export const KanbanTaskDetailSchema = KanbanTaskSchema.extend({
	column: KanbanColumnSummarySchema,
	children: z.array(KanbanItemSummarySchema),
	links: z.array(KanbanLinkSchema),
	stepItems: z.array(KanbanStepSchema),
	acceptanceCriterionItems: z.array(KanbanAcceptanceCriterionSchema),
	watchers: z.array(KanbanPersonSchema),
	isWatching: z.boolean(),
	attachments: z.array(KanbanAttachmentSchema),
});
export type KanbanTaskDetail = z.output<typeof KanbanTaskDetailSchema>;

export const KanbanCommentSchema = z.object({
	id: z.uuid(),
	taskId: z.uuid(),
	body: z.string(),
	author: KanbanPersonSchema,
	/** The files posted with the comment, in the order they were posted. */
	attachments: z.array(KanbanAttachmentSchema),
	createdAt: EpochMsSchema,
});
export type KanbanComment = z.output<typeof KanbanCommentSchema>;

/**
 * One entry of an item's history. `from` / `to` are the values as they were
 * then: a column title, a person's name, an enum value, epoch ms as text, a
 * file name, the other item's title — read with `kind` (and `field`).
 */
export const KanbanActivitySchema = z.object({
	id: z.uuid(),
	taskId: z.uuid(),
	kind: KanbanActivityKindSchema,
	field: KanbanActivityFieldSchema.nullable(),
	from: z.string().nullable(),
	to: z.string().nullable(),
	actor: KanbanPersonSchema,
	createdAt: EpochMsSchema,
});
export type KanbanActivity = z.output<typeof KanbanActivitySchema>;

/** `GET /admin/kanban/people` — everyone who can be assigned an item (holds READ on KANBAN_TASK), by name. */
export const KanbanPeopleSchema = z.object({
	people: z.array(KanbanPersonSchema),
});
export type KanbanPeople = z.output<typeof KanbanPeopleSchema>;

/** `GET …/attachments/:attachmentId/download` — a short-lived signed link that downloads the original upload. */
export const KanbanAttachmentDownloadSchema = z.object({
	attachmentId: z.uuid(),
	fileName: z.string().min(1),
	downloadUrl: z.string().min(1),
	expiresAt: EpochMsSchema,
});
export type KanbanAttachmentDownload = z.output<typeof KanbanAttachmentDownloadSchema>;

// ── Requests (strict: an unknown key is a caller bug) ───────────────────────

/** `GET /admin/kanban/board` — which of the two boards. */
export const KanbanBoardQuerySchema = z.object({ board: KanbanBoardKindSchema }).strict();
export type KanbanBoardQuery = z.output<typeof KanbanBoardQuerySchema>;

export const KanbanTaskPathSchema = z.object({ taskId: z.uuid() }).strict();
export type KanbanTaskPath = z.output<typeof KanbanTaskPathSchema>;

export const KanbanColumnPathSchema = z.object({ columnId: z.uuid() }).strict();
export type KanbanColumnPath = z.output<typeof KanbanColumnPathSchema>;

export const KanbanAttachmentPathSchema = z.object({ taskId: z.uuid(), attachmentId: z.uuid() }).strict();
export type KanbanAttachmentPath = z.output<typeof KanbanAttachmentPathSchema>;

export const KanbanLinkPathSchema = z.object({ taskId: z.uuid(), linkId: z.uuid() }).strict();
export type KanbanLinkPath = z.output<typeof KanbanLinkPathSchema>;

export const KanbanChecklistItemPathSchema = z.object({ taskId: z.uuid(), itemId: z.uuid() }).strict();
export type KanbanChecklistItemPath = z.output<typeof KanbanChecklistItemPathSchema>;

/** The fields a person writes on an item (its type is chosen once, at creation). */
const KANBAN_TASK_FIELDS = {
	title: KanbanTaskTitleSchema,
	description: KanbanTaskDescriptionSchema,
	priority: KanbanTaskPrioritySchema,
	team: KanbanTeamSchema,
	labels: KanbanLabelsSchema,
	parentId: z.uuid().nullable(),
	assigneeId: z.uuid().nullable(),
	startAt: EpochMsSchema.nullable(),
	dueAt: EpochMsSchema.nullable(),
	storyPoints: KanbanStoryPointsSchema.nullable(),
	progress: KanbanTaskProgressSchema,
};

/** Adds every broken hierarchy rule of `fields` to `ctx`, on the field it concerns. */
function addRuleIssues(fields: KanbanItemRuleFields, ctx: z.RefinementCtx): void {
	for (const issue of kanbanItemRuleIssues(fields)) {
		ctx.addIssue({ code: "custom", path: [issue.field], message: issue.message });
	}
}

/**
 * `POST /admin/kanban/tasks` — a new item at the bottom of `columnId` (a column
 * of the board its type lives on). The caller becomes its reporter and watcher.
 */
export const CreateKanbanTaskSchema = z
	.object({
		columnId: z.uuid(),
		type: KanbanItemTypeSchema,
		...KANBAN_TASK_FIELDS,
		labels: KanbanLabelsSchema.default([]),
		parentId: z.uuid().nullable().default(null),
		assigneeId: z.uuid().nullable().default(null),
		startAt: EpochMsSchema.nullable().default(null),
		dueAt: EpochMsSchema.nullable().default(null),
		storyPoints: KanbanStoryPointsSchema.nullable().default(null),
	})
	.strict()
	.superRefine((input, ctx) => {
		addRuleIssues({ ...input, stepCount: 0, acceptanceCriterionCount: 0 }, ctx);
	});
export type CreateKanbanTaskInput = z.output<typeof CreateKanbanTaskSchema>;

/**
 * `POST /admin/kanban/tasks/import` — several items at once (a CSV import) onto
 * one board, in order, each at the bottom of its column; all or none. The caller
 * reports them all. Answers that board.
 */
export const ImportKanbanTasksSchema = z
	.object({
		board: KanbanBoardKindSchema,
		tasks: z.array(CreateKanbanTaskSchema).min(1).max(BULK_MUTATION_MAX_ITEMS),
	})
	.strict();
export type ImportKanbanTasksInput = z.output<typeof ImportKanbanTasksSchema>;

/**
 * One step of an edit, in order. `id` names a row the subtask already has
 * (kept and updated); a row without one is new; a stored row left out is removed.
 */
export const KanbanStepInputSchema = z
	.object({
		id: z.uuid().optional(),
		title: KanbanChecklistTitleSchema,
		depth: KanbanStepDepthSchema,
		isDone: z.boolean(),
		assigneeId: z.uuid().nullable(),
	})
	.strict();
export type KanbanStepInput = z.output<typeof KanbanStepInputSchema>;

/** One acceptance criterion of an edit, in order (`id` as for steps). */
export const KanbanAcceptanceCriterionInputSchema = z
	.object({
		id: z.uuid().optional(),
		title: KanbanChecklistTitleSchema,
		isDone: z.boolean(),
	})
	.strict();
export type KanbanAcceptanceCriterionInput = z.output<typeof KanbanAcceptanceCriterionInputSchema>;

/** Rows that name the same stored row twice cannot both keep it. */
function hasDuplicateIds(rows: readonly { readonly id?: string | undefined }[]): boolean {
	const ids = rows.flatMap((row) => (row.id === undefined ? [] : [row.id]));
	return new Set(ids).size !== ids.length;
}

/**
 * A subtask's steps, top to bottom: the first row is a sub-subtask, and a row is
 * at most one level deeper than the row above it — so the order alone draws the tree.
 */
export const KanbanStepListSchema = z
	.array(KanbanStepInputSchema)
	.max(KANBAN_STEP_LIMIT)
	.superRefine((rows, ctx) => {
		let previousDepth = -1;
		rows.forEach((row, index) => {
			if (row.depth > previousDepth + 1) {
				ctx.addIssue({ code: "custom", path: [index, "depth"], message: "A row is at most one level deeper than the row above it." });
			}
			previousDepth = row.depth;
		});
		if (hasDuplicateIds(rows)) {
			ctx.addIssue({ code: "custom", message: "Each stored row once." });
		}
	});

export const KanbanAcceptanceCriterionListSchema = z
	.array(KanbanAcceptanceCriterionInputSchema)
	.max(KANBAN_ACCEPTANCE_CRITERIA_LIMIT)
	.refine((rows) => !hasDuplicateIds(rows), "Each stored row once.");

/**
 * `PATCH /admin/kanban/tasks/:taskId` — any subset of the fields (a checklist
 * sent replaces the stored one), plus the `version` the client read (optimistic
 * locking, rules/08 → "Race conditions", option B). A stale version answers 409
 * `KANBAN_TASK_STALE`; the hierarchy's rules are checked against the item as it
 * would stand after the edit. The parent is not one of the fields: an item
 * changes parent only through `…/parent` (Move to…).
 */
export const UpdateKanbanTaskSchema = z
	.object(KANBAN_TASK_FIELDS)
	.omit({ parentId: true })
	.partial()
	.extend({
		steps: KanbanStepListSchema.optional(),
		acceptanceCriteria: KanbanAcceptanceCriterionListSchema.optional(),
		version: OptimisticVersionSchema.meta({ description: "The item `version` this edit is based on (optimistic lock)", example: 3 }),
	})
	.strict();
export type UpdateKanbanTaskInput = z.output<typeof UpdateKanbanTaskSchema>;

/**
 * `POST /admin/kanban/tasks/:taskId/move` — put the item in `columnId` (on its
 * own board), right below `afterTaskId` (`null`: at the top). An anchor rather
 * than an index, so a move made on a filtered board lands where the person saw it.
 */
export const MoveKanbanTaskSchema = z
	.object({
		columnId: z.uuid(),
		afterTaskId: z.uuid().nullable(),
		version: OptimisticVersionSchema.meta({ description: "The item `version` this move is based on (optimistic lock)", example: 3 }),
	})
	.strict();
export type MoveKanbanTaskInput = z.output<typeof MoveKanbanTaskSchema>;

/**
 * `POST /admin/kanban/tasks/:taskId/parent` — Move to…: put the item under
 * another live parent one level up (or under none, where its level allows it),
 * based on the item `version` the client read. Its column and place stay; the
 * history records the old and the new parent. Undo is the same call back.
 */
export const MoveKanbanItemToParentSchema = z
	.object({
		parentId: z.uuid().nullable(),
		version: OptimisticVersionSchema.meta({ description: "The item `version` this move is based on (optimistic lock)", example: 3 }),
	})
	.strict();
export type MoveKanbanItemToParentInput = z.output<typeof MoveKanbanItemToParentSchema>;

/** `POST /admin/kanban/columns/:columnId/move` — put the column right of `afterColumnId` (`null`: first) on its board. */
export const MoveKanbanColumnSchema = z
	.object({
		afterColumnId: z.uuid().nullable(),
		version: OptimisticVersionSchema.meta({ description: "The column `version` this move is based on (optimistic lock)", example: 1 }),
	})
	.strict();
export type MoveKanbanColumnInput = z.output<typeof MoveKanbanColumnSchema>;

/** `PATCH /admin/kanban/columns/:columnId` — set or clear the column's soft WIP limit. */
export const UpdateKanbanColumnSchema = z
	.object({
		wipLimit: z.number().int().min(1).max(KANBAN_COLUMN_TASK_LIMIT).nullable(),
		version: OptimisticVersionSchema.meta({ description: "The column `version` this edit is based on (optimistic lock)", example: 1 }),
	})
	.strict();
export type UpdateKanbanColumnInput = z.output<typeof UpdateKanbanColumnSchema>;

/**
 * `POST /admin/kanban/tasks/:taskId/comments` — text, files the caller uploaded
 * as `KANBAN_TASK_ATTACHMENT` (READY, each once), or both; never neither. The
 * files become the item's attachments, posted with the comment.
 */
export const CreateKanbanCommentSchema = z
	.object({
		body: KanbanCommentBodySchema,
		fileIds: z
			.array(z.uuid())
			.max(KANBAN_COMMENT_FILE_LIMIT)
			.refine((fileIds) => new Set(fileIds).size === fileIds.length, "Each file once")
			.default([]),
	})
	.strict()
	.refine((comment) => comment.body.length > 0 || comment.fileIds.length > 0, { path: ["body"], message: "Write a comment or attach a file." });
export type CreateKanbanCommentInput = z.output<typeof CreateKanbanCommentSchema>;

/**
 * `POST /admin/kanban/tasks/:taskId/attachments` — attach a READY
 * `KANBAN_TASK_ATTACHMENT` file the caller uploaded (`POST /files/upload-url`).
 */
export const AttachKanbanFileSchema = z
	.object({
		fileId: z.uuid(),
	})
	.strict();
export type AttachKanbanFileInput = z.output<typeof AttachKanbanFileSchema>;

/** `POST /admin/kanban/tasks/:taskId/links` — link the item to another live item, as the item sees it. */
export const CreateKanbanLinkSchema = z
	.object({
		targetTaskId: z.uuid(),
		kind: KanbanLinkKindSchema,
	})
	.strict();
export type CreateKanbanLinkInput = z.output<typeof CreateKanbanLinkSchema>;

/** `PATCH /admin/kanban/tasks/:taskId/checklist/:itemId` — tick a step or an acceptance criterion off, or on again. */
export const SetKanbanChecklistItemSchema = z
	.object({
		isDone: z.boolean(),
	})
	.strict();
export type SetKanbanChecklistItemInput = z.output<typeof SetKanbanChecklistItemSchema>;

/** `GET /admin/kanban/tasks/:taskId/comments` — newest first (docs/technical/api/list-queries.md). */
export const kanbanCommentListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {},
	params: {},
});
export const KanbanCommentListQuerySchema = kanbanCommentListQuery.schema;
export type KanbanCommentListQuery = z.output<typeof KanbanCommentListQuerySchema>;
export type KanbanCommentListSortField = (typeof kanbanCommentListQuery.sortable)[number];

/** The comment list's input: the item from the path, plus the list grammar. */
export const KanbanTaskCommentsQuerySchema = z.intersection(KanbanTaskPathSchema, KanbanCommentListQuerySchema);
export type KanbanTaskCommentsQuery = z.output<typeof KanbanTaskCommentsQuerySchema>;

/** `GET /admin/kanban/tasks/:taskId/activity` — the item's history, newest first. */
export const kanbanActivityListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {},
	params: {},
});
export const KanbanActivityListQuerySchema = kanbanActivityListQuery.schema;
export type KanbanActivityListQuery = z.output<typeof KanbanActivityListQuerySchema>;
export type KanbanActivityListSortField = (typeof kanbanActivityListQuery.sortable)[number];

/** The activity list's input: the item from the path, plus the list grammar. */
export const KanbanTaskActivityQuerySchema = z.intersection(KanbanTaskPathSchema, KanbanActivityListQuerySchema);
export type KanbanTaskActivityQuery = z.output<typeof KanbanTaskActivityQuerySchema>;

/**
 * `GET /admin/kanban/items` — live items of either board, for a parent or link
 * picker: filtered by type, searched by title, alphabetical by default.
 */
export const kanbanItemListQuery = defineListQuery({
	sortable: ["title", "createdAt"],
	defaultSort: [{ field: "title", direction: "asc" }],
	filter: {
		type: listFilter.enumeration(KanbanItemTypeSchema, { eq: true, in: true }),
	},
	params: { search: ListSearchSchema },
});
export const KanbanItemListQuerySchema = kanbanItemListQuery.schema;
export type KanbanItemListQuery = z.output<typeof KanbanItemListQuerySchema>;
export type KanbanItemListSortField = (typeof kanbanItemListQuery.sortable)[number];

/**
 * `GET /admin/kanban/search?q=…` — live items of either board ranked for a
 * person looking one up: an exact key first (`story-142` finds STORY-142),
 * then keys that start with the text, then titles that contain it, at most
 * `limit`. `type` narrows it to one level (the Move to… picker asks for the
 * valid parent level only).
 */
export const KanbanSearchQuerySchema = z
	.object({
		q: z.string().trim().min(1).max(KANBAN_TASK_TITLE_MAX_LENGTH),
		type: KanbanItemTypeSchema.optional(),
		limit: z.coerce.number().int().min(1).max(KANBAN_SEARCH_LIMIT).default(KANBAN_SEARCH_LIMIT),
	})
	.strict();
export type KanbanSearchQuery = z.output<typeof KanbanSearchQuerySchema>;

/** How a search result matched, best first. */
export const KanbanSearchMatchSchema = z.enum(["KEY", "KEY_PREFIX", "TITLE"]);
export type KanbanSearchMatch = z.output<typeof KanbanSearchMatchSchema>;

/** One ranked search result: the item as a list row, its parent chain, and how it matched. */
export const KanbanSearchResultSchema = KanbanItemSummarySchema.extend({
	ancestors: z.array(KanbanItemRefSchema),
	match: KanbanSearchMatchSchema,
});
export type KanbanSearchResult = z.output<typeof KanbanSearchResultSchema>;

export const KanbanSearchResultsSchema = z.object({
	results: z.array(KanbanSearchResultSchema),
});
export type KanbanSearchResults = z.output<typeof KanbanSearchResultsSchema>;
