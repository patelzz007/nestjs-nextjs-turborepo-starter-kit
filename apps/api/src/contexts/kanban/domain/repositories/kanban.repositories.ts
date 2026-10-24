import type { KanbanActivityField, KanbanActivityKind, KanbanAttachmentKind, KanbanBoardKind, KanbanItemType, KanbanTaskPriority, KanbanTeam } from "@workspace/shared";

import type { KanbanBoardArrangement } from "../aggregates/kanban-board-arrangement.aggregate";
import type { KanbanStoredLink } from "../policies/kanban-link.policy";
import type { KanbanChecklistPlan, KanbanChecklistRow } from "../services/kanban-checklist-plan";
import type { KanbanItemFields } from "../services/kanban-item-changes";

/**
 * Both boards' arrangement, bound to one transaction. `lockForUpdate` takes the
 * board-wide lock (held until commit) and reads the live columns and items in
 * order, so every change that reorders a board — or reads the hierarchy to
 * change it — runs one at a time.
 */
export interface KanbanBoardRepository {
	lockForUpdate(): Promise<KanbanBoardArrangement>;
	/** Writes the placements and version bumps the board reports; a bump that finds a newer version throws the stale error. */
	saveArrangement(board: KanbanBoardArrangement): Promise<void>;
	/** The live column's title (on either board), or `null` when it is missing. */
	columnTitle(columnId: string): Promise<string | null>;
	/** Sets the execution column's WIP limit while it is still at `expectedVersion`; false when it is stale or missing. */
	setWipLimit(columnId: string, wipLimit: number | null, expectedVersion: number): Promise<boolean>;
}

/**
 * The level counters: each call hands out the next `count` numbers of `type`
 * as keys (`STORY-143`, `STORY-144`), in the caller's transaction — the counter
 * row stays locked until commit, so two creates never share a number, and a
 * number is never handed out again (not even after a soft delete).
 */
export interface KanbanKeyRepository {
	next(type: KanbanItemType, count: number): Promise<readonly string[]>;
}

/** A live item as an edit reads it: its fields, its place in the hierarchy and its concurrency token. */
export interface KanbanItemRecord extends KanbanItemFields {
	readonly id: string;
	readonly type: KanbanItemType;
	readonly version: number;
}

/** A live item as another item names it. */
export interface KanbanItemRefRecord {
	readonly id: string;
	readonly key: string | null;
	readonly type: KanbanItemType;
	readonly title: string;
}

/** What a new item is created with. */
export interface NewKanbanItemFields {
	readonly columnId: string;
	readonly type: KanbanItemType;
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

/** A new item as it is stored: its fields, its id and key, its reporter and the place the board gave it. */
export interface NewKanbanTask {
	readonly id: string;
	readonly key: string;
	readonly ownerId: string;
	/** The board of `input.columnId`: which column field the item is stored in. */
	readonly board: KanbanBoardKind;
	readonly position: number;
	readonly input: NewKanbanItemFields;
}

/** How a conditional item edit ended. */
export type KanbanTaskRevision = "revised" | "stale" | "missing";

export interface KanbanTaskRepository {
	create(task: NewKanbanTask): Promise<void>;
	/** Inserts every item in one statement. */
	createMany(tasks: readonly NewKanbanTask[]): Promise<void>;
	/** The live item, or `null`. */
	findLive(taskId: string): Promise<KanbanItemRecord | null>;
	/** The live items among `taskIds` (missing or deleted ones are left out). */
	findRefs(taskIds: readonly string[]): Promise<readonly KanbanItemRefRecord[]>;
	/**
	 * Writes `fields` (the item as it stands after the edit) and bumps the version,
	 * only while the live item is still at `expectedVersion` (optimistic lock).
	 */
	revise(taskId: string, fields: KanbanItemFields, expectedVersion: number): Promise<KanbanTaskRevision>;
	/** Bumps the live item's version (its checklist changed), so an edit based on an older read is refused. */
	touch(taskId: string): Promise<void>;
	/** Live items whose parent is `taskId`. */
	countLiveChildren(taskId: string): Promise<number>;
	/** Soft-deletes the live item; false when it is already gone. */
	softDelete(taskId: string, deletedBy: string, deletedAt: number): Promise<boolean>;
	/** True when the item is live; takes its row lock until commit, so concurrent writes to it run one at a time. */
	lockLive(taskId: string): Promise<boolean>;
	/** True when the item is live. */
	existsLive(taskId: string): Promise<boolean>;
}

export interface NewKanbanComment {
	readonly id: string;
	readonly taskId: string;
	readonly authorId: string;
	readonly body: string;
}

export interface KanbanCommentRepository {
	create(comment: NewKanbanComment): Promise<void>;
}

export interface NewKanbanAttachment {
	readonly id: string;
	readonly taskId: string;
	/** The comment the file is posted with, or `null` when it is attached to the item directly. */
	readonly commentId: string | null;
	readonly fileId: string;
	readonly kind: KanbanAttachmentKind;
}

export interface KanbanAttachmentRepository {
	/** Live attachments of the item whose file is live too. */
	countLive(taskId: string): Promise<number>;
	/** True when the file is attached to a live attachment row already (any item). */
	isFileAttached(fileId: string): Promise<boolean>;
	create(attachment: NewKanbanAttachment): Promise<void>;
}

/** Which of an item's two checklists: a subtask's steps, or a feature's or story's acceptance criteria. */
export type KanbanChecklistList = "STEPS" | "ACCEPTANCE_CRITERIA";

/** One live checklist row and the list it belongs to. */
export interface KanbanChecklistEntry {
	readonly id: string;
	readonly list: KanbanChecklistList;
	readonly title: string;
	readonly isDone: boolean;
}

export interface KanbanChecklistRepository {
	/** The item's live rows of `list`, top to bottom. */
	listLive(taskId: string, list: KanbanChecklistList): Promise<readonly KanbanChecklistRow[]>;
	/** Writes a replacement plan: creates, updates and soft-deletes (by `deletedBy` at `deletedAt`). */
	apply(taskId: string, list: KanbanChecklistList, plan: KanbanChecklistPlan, deletedBy: string, deletedAt: number): Promise<void>;
	/** The item's live row `itemId` (of either list), or `null`. */
	findLive(taskId: string, itemId: string): Promise<KanbanChecklistEntry | null>;
	setDone(itemId: string, isDone: boolean): Promise<void>;
}

/** A live link and its id. */
export interface KanbanLinkRecord extends KanbanStoredLink {
	readonly id: string;
}

export interface KanbanLinkRepository {
	/**
	 * True when the two items are linked that way already: the same blocking link,
	 * the reverse one (two items never block each other), or a relation either way.
	 */
	conflictsWith(link: KanbanStoredLink): Promise<boolean>;
	create(id: string, link: KanbanStoredLink): Promise<void>;
	/** The live link `linkId` with `taskId` at one of its ends, or `null`. */
	findLiveOfTask(taskId: string, linkId: string): Promise<KanbanLinkRecord | null>;
	softDelete(linkId: string, deletedBy: string, deletedAt: number): Promise<void>;
}

export interface KanbanWatcherRepository {
	isWatching(taskId: string, userId: string): Promise<boolean>;
	watch(id: string, taskId: string, userId: string): Promise<void>;
	/** Soft-deletes the person's live watch; false when they were not watching. */
	unwatch(taskId: string, userId: string, deletedBy: string, deletedAt: number): Promise<boolean>;
}

/** One history row, written with the change it records. */
export interface NewKanbanActivity {
	readonly id: string;
	readonly taskId: string;
	readonly actorId: string;
	readonly kind: KanbanActivityKind;
	readonly field: KanbanActivityField | null;
	readonly from: string | null;
	readonly to: string | null;
}

export interface KanbanActivityRepository {
	/** Inserts every row in one statement. */
	append(entries: readonly NewKanbanActivity[]): Promise<void>;
}

export interface KanbanPeopleRepository {
	/** Names of the live accounts among `userIds`, by id. */
	namesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
