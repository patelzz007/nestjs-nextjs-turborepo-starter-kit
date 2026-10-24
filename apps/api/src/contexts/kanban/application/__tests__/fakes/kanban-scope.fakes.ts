import { epochMs, kanbanItemKey, type KanbanBoardKind, type KanbanItemType } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { BindableFile, FileBindingRequest, FileReferencePort } from "../../../../files/public-api";
import { KanbanBoardArrangement } from "../../../domain/aggregates/kanban-board-arrangement.aggregate";
import { KanbanColumnStaleError, KanbanTaskStaleError } from "../../../domain/errors/kanban.errors";
import type { KanbanStoredLink } from "../../../domain/policies/kanban-link.policy";
import type {
	KanbanActivityRepository,
	KanbanAttachmentRepository,
	KanbanBoardRepository,
	KanbanChecklistEntry,
	KanbanChecklistList,
	KanbanChecklistRepository,
	KanbanCommentRepository,
	KanbanItemRecord,
	KanbanItemRefRecord,
	KanbanKeyRepository,
	KanbanLinkRecord,
	KanbanLinkRepository,
	KanbanPeopleRepository,
	KanbanTaskRepository,
	KanbanTaskRevision,
	KanbanWatcherRepository,
	NewKanbanActivity,
	NewKanbanAttachment,
	NewKanbanComment,
	NewKanbanTask,
} from "../../../domain/repositories/kanban.repositories";
import type { KanbanChecklistPlan, KanbanChecklistRow } from "../../../domain/services/kanban-checklist-plan";
import type { KanbanItemFields } from "../../../domain/services/kanban-item-changes";
import type { KanbanScope } from "../../kanban-scope";
import type { KanbanAssigneesPort } from "../../ports/kanban-assignees.port";
import type { KanbanIdGenerator } from "../../ports/kanban.tokens";

export const STAFF_ID = "0199d0c0-0000-7000-8000-000000000001";
export const OTHER_STAFF_ID = "0199d0c0-0000-7000-8000-000000000002";
export const TODO_ID = "0199d0c0-0000-7000-8000-0000000000a1";
export const DOING_ID = "0199d0c0-0000-7000-8000-0000000000a2";
export const PLAN_ID = "0199d0c0-0000-7000-8000-0000000000a3";
export const NOW = epochMs(1_793_000_000_000);

/** The people the fake directory knows by name. */
export const STAFF_NAMES: ReadonlyMap<string, string> = new Map([
	[STAFF_ID, "Admin User"],
	[OTHER_STAFF_ID, "Carol White"],
]);

export interface FakeColumnRow {
	readonly id: string;
	readonly board: KanbanBoardKind;
	readonly title: string;
	position: number;
	version: number;
	wipLimit: number | null;
}

export interface FakeTaskRow {
	readonly id: string;
	readonly key: string;
	readonly type: KanbanItemType;
	columnId: string;
	position: number;
	version: number;
	isDeleted: boolean;
	deletedBy: string | null;
	readonly ownerId: string;
	fields: KanbanItemFields;
}

export interface FakeAttachmentRow extends NewKanbanAttachment {
	isDeleted: boolean;
}

export interface FakeChecklistRow extends KanbanChecklistRow {
	readonly taskId: string;
	readonly list: KanbanChecklistList;
	isDeleted: boolean;
}

export interface FakeLinkRow extends KanbanLinkRecord {
	isDeleted: boolean;
}

export interface FakeWatcherRow {
	readonly id: string;
	readonly taskId: string;
	readonly userId: string;
	isDeleted: boolean;
}

/** The fields every seeded item starts from. */
export const TASK_FIELDS: KanbanItemFields = {
	title: "Write the spec",
	description: "",
	priority: "MEDIUM",
	team: "BACKEND",
	labels: [],
	parentId: null,
	assigneeId: null,
	startAt: null,
	dueAt: null,
	storyPoints: null,
	progress: 0,
};

/** Both boards' rows, shared by the scope's repositories (one "transaction"). */
export class InMemoryKanbanStore {
	public readonly columns: FakeColumnRow[] = [
		{ id: TODO_ID, board: "EXECUTION", title: "To do", position: 0, version: 0, wipLimit: null },
		{ id: DOING_ID, board: "EXECUTION", title: "Doing", position: 1, version: 0, wipLimit: null },
		{ id: PLAN_ID, board: "PLANNING", title: "Backlog", position: 0, version: 0, wipLimit: null },
	];
	public readonly tasks = new Map<string, FakeTaskRow>();
	public readonly comments: NewKanbanComment[] = [];
	public readonly attachments: FakeAttachmentRow[] = [];
	public readonly checklist: FakeChecklistRow[] = [];
	public readonly links: FakeLinkRow[] = [];
	public readonly watchers: FakeWatcherRow[] = [];
	public readonly activity: NewKanbanActivity[] = [];
	public readonly files = new Map<string, BindableFile>();
	public boardLocks = 0;
	public readonly lockedTasks: string[] = [];
	/** The last key number handed out per level (`KanbanLevelCounter`). */
	public readonly counters = new Map<KanbanItemType, number>();

	/** Adds a live item at the bottom of `columnId` (a story unless `type` says otherwise). */
	public seedTask(id: string, columnId: string, version = 0, type: KanbanItemType = "STORY", fields: Partial<KanbanItemFields> = {}): FakeTaskRow {
		const position = this.liveTasksIn(columnId).length;
		const keyNumber = (this.counters.get(type) ?? 0) + 1;
		this.counters.set(type, keyNumber);
		const row: FakeTaskRow = {
			id,
			key: kanbanItemKey(type, keyNumber),
			type,
			columnId,
			position,
			version,
			isDeleted: false,
			deletedBy: null,
			ownerId: STAFF_ID,
			fields: { ...TASK_FIELDS, ...fields },
		};
		this.tasks.set(id, row);
		return row;
	}

	public seedChecklistRow(row: Omit<FakeChecklistRow, "isDeleted" | "position">): FakeChecklistRow {
		const position = this.checklist.filter((candidate) => candidate.taskId === row.taskId && candidate.list === row.list && !candidate.isDeleted).length;
		const seeded: FakeChecklistRow = { ...row, position, isDeleted: false };
		this.checklist.push(seeded);
		return seeded;
	}

	public seedFile(file: Partial<BindableFile> & Pick<BindableFile, "id">): void {
		this.files.set(file.id, {
			category: "KANBAN_TASK_ATTACHMENT",
			status: "READY",
			tenantId: null,
			uploadedById: STAFF_ID,
			originalName: "plan.pdf",
			mimeType: "application/pdf",
			...file,
		});
	}

	public liveTasksIn(columnId: string): FakeTaskRow[] {
		return [...this.tasks.values()].filter((task) => task.columnId === columnId && !task.isDeleted).sort((left, right) => left.position - right.position);
	}

	/** Item ids of `columnId`, top to bottom. */
	public order(columnId: string): string[] {
		return this.liveTasksIn(columnId).map((task) => task.id);
	}

	/** The live rows of one item's list, top to bottom. */
	public liveChecklist(taskId: string, list: KanbanChecklistList): FakeChecklistRow[] {
		return this.checklist.filter((row) => row.taskId === taskId && row.list === list && !row.isDeleted).sort((left, right) => left.position - right.position);
	}

	/** The history, as `kind:field:from→to` lines a test reads at a glance. */
	public history(): string[] {
		return this.activity.map((entry) => `${entry.taskId} ${entry.kind}${entry.field === null ? "" : `:${entry.field}`} ${entry.from ?? "∅"}→${entry.to ?? "∅"}`);
	}
}

const BOARD_ORDER: Readonly<Record<KanbanBoardKind, number>> = { PLANNING: 0, EXECUTION: 1 };

class FakeBoardRepository implements KanbanBoardRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public lockForUpdate(): Promise<KanbanBoardArrangement> {
		this.store.boardLocks += 1;
		const columns = [...this.store.columns]
			.sort((left, right) => BOARD_ORDER[left.board] - BOARD_ORDER[right.board] || left.position - right.position)
			.map((column) => ({
				id: column.id,
				board: column.board,
				version: column.version,
				tasks: this.store.liveTasksIn(column.id).map((task) => ({ id: task.id, type: task.type, version: task.version })),
			}));
		return Promise.resolve(KanbanBoardArrangement.rehydrate({ columns }));
	}

	public saveArrangement(board: KanbanBoardArrangement): Promise<void> {
		for (const placement of board.changedTaskPlacements()) {
			const task = this.store.tasks.get(placement.taskId);
			if (task !== undefined && !task.isDeleted) {
				task.columnId = placement.columnId;
				task.position = placement.position;
			}
		}
		for (const placement of board.changedColumnPlacements()) {
			const column = this.store.columns.find((candidate) => candidate.id === placement.columnId);
			if (column !== undefined) {
				column.position = placement.position;
			}
		}
		for (const bump of board.taskVersionBumps()) {
			const task = this.store.tasks.get(bump.id);
			if (task?.version !== bump.expectedVersion) {
				return Promise.reject(new KanbanTaskStaleError(bump.id));
			}
			task.version += 1;
		}
		for (const bump of board.columnVersionBumps()) {
			const column = this.store.columns.find((candidate) => candidate.id === bump.id);
			if (column?.version !== bump.expectedVersion) {
				return Promise.reject(new KanbanColumnStaleError(bump.id));
			}
			column.version += 1;
		}
		return Promise.resolve();
	}

	public columnTitle(columnId: string): Promise<string | null> {
		return Promise.resolve(this.store.columns.find((column) => column.id === columnId)?.title ?? null);
	}

	public setWipLimit(columnId: string, wipLimit: number | null, expectedVersion: number): Promise<boolean> {
		const column = this.store.columns.find((candidate) => candidate.id === columnId);
		if (column?.version !== expectedVersion) {
			return Promise.resolve(false);
		}
		column.wipLimit = wipLimit;
		column.version += 1;
		return Promise.resolve(true);
	}
}

class FakeKeyRepository implements KanbanKeyRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public next(type: KanbanItemType, count: number): Promise<readonly string[]> {
		const last = this.store.counters.get(type) ?? 0;
		this.store.counters.set(type, last + count);
		return Promise.resolve(Array.from({ length: count }, (_unused: undefined, offset: number): string => kanbanItemKey(type, last + offset + 1)));
	}
}

class FakeTaskRepository implements KanbanTaskRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public create(task: NewKanbanTask): Promise<void> {
		const { columnId, type, ...fields } = task.input;
		this.store.tasks.set(task.id, {
			id: task.id,
			key: task.key,
			type,
			columnId,
			position: task.position,
			version: 0,
			isDeleted: false,
			deletedBy: null,
			ownerId: task.ownerId,
			fields,
		});
		return Promise.resolve();
	}

	public async createMany(tasks: readonly NewKanbanTask[]): Promise<void> {
		for (const task of tasks) {
			await this.create(task);
		}
	}

	public findLive(taskId: string): Promise<KanbanItemRecord | null> {
		const task = this.live(taskId);
		return Promise.resolve(task === undefined ? null : { id: task.id, type: task.type, version: task.version, ...task.fields });
	}

	public findRefs(taskIds: readonly string[]): Promise<readonly KanbanItemRefRecord[]> {
		return Promise.resolve(
			taskIds.flatMap((taskId): KanbanItemRefRecord[] => {
				const task = this.live(taskId);
				return task === undefined ? [] : [{ id: task.id, key: task.key, type: task.type, title: task.fields.title }];
			}),
		);
	}

	public revise(taskId: string, fields: KanbanItemFields, expectedVersion: number): Promise<KanbanTaskRevision> {
		const task = this.live(taskId);
		if (task === undefined) {
			return Promise.resolve("missing");
		}
		if (task.version !== expectedVersion) {
			return Promise.resolve("stale");
		}
		task.fields = { ...fields };
		task.version = expectedVersion + 1;
		return Promise.resolve("revised");
	}

	public touch(taskId: string): Promise<void> {
		const task = this.live(taskId);
		if (task !== undefined) {
			task.version += 1;
		}
		return Promise.resolve();
	}

	public countLiveChildren(taskId: string): Promise<number> {
		return Promise.resolve([...this.store.tasks.values()].filter((task) => task.fields.parentId === taskId && !task.isDeleted).length);
	}

	public softDelete(taskId: string, deletedBy: string): Promise<boolean> {
		const task = this.live(taskId);
		if (task === undefined) {
			return Promise.resolve(false);
		}
		task.isDeleted = true;
		task.deletedBy = deletedBy;
		return Promise.resolve(true);
	}

	public lockLive(taskId: string): Promise<boolean> {
		this.store.lockedTasks.push(taskId);
		return this.existsLive(taskId);
	}

	public existsLive(taskId: string): Promise<boolean> {
		return Promise.resolve(this.live(taskId) !== undefined);
	}

	private live(taskId: string): FakeTaskRow | undefined {
		const task = this.store.tasks.get(taskId);
		return task?.isDeleted === false ? task : undefined;
	}
}

class FakeCommentRepository implements KanbanCommentRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public create(comment: NewKanbanComment): Promise<void> {
		this.store.comments.push(comment);
		return Promise.resolve();
	}
}

class FakeAttachmentRepository implements KanbanAttachmentRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public countLive(taskId: string): Promise<number> {
		return Promise.resolve(this.store.attachments.filter((attachment) => attachment.taskId === taskId && !attachment.isDeleted).length);
	}

	public isFileAttached(fileId: string): Promise<boolean> {
		return Promise.resolve(this.store.attachments.some((attachment) => attachment.fileId === fileId && !attachment.isDeleted));
	}

	public create(attachment: NewKanbanAttachment): Promise<void> {
		this.store.attachments.push({ ...attachment, isDeleted: false });
		return Promise.resolve();
	}
}

class FakeChecklistRepository implements KanbanChecklistRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public listLive(taskId: string, list: KanbanChecklistList): Promise<readonly KanbanChecklistRow[]> {
		return Promise.resolve(
			this.store.liveChecklist(taskId, list).map(({ id, title, depth, isDone, assigneeId, position }) => ({ id, title, depth, isDone, assigneeId, position })),
		);
	}

	public apply(taskId: string, list: KanbanChecklistList, plan: KanbanChecklistPlan): Promise<void> {
		for (const row of this.store.checklist) {
			if (row.taskId === taskId && row.list === list && plan.removals.includes(row.id)) {
				row.isDeleted = true;
			}
		}
		for (const update of plan.updates) {
			const index = this.store.checklist.findIndex((row) => row.id === update.id);
			const current = this.store.checklist.at(index);
			if (current !== undefined) {
				this.store.checklist.splice(index, 1, { ...current, ...update });
			}
		}
		this.store.checklist.push(...plan.creates.map((row) => ({ ...row, taskId, list, isDeleted: false })));
		return Promise.resolve();
	}

	public findLive(taskId: string, itemId: string): Promise<KanbanChecklistEntry | null> {
		const row = this.store.checklist.find((candidate) => candidate.id === itemId && candidate.taskId === taskId && !candidate.isDeleted);
		return Promise.resolve(row === undefined ? null : { id: row.id, list: row.list, title: row.title, isDone: row.isDone });
	}

	public setDone(itemId: string, isDone: boolean): Promise<void> {
		const index = this.store.checklist.findIndex((row) => row.id === itemId);
		const current = this.store.checklist.at(index);
		if (current !== undefined) {
			this.store.checklist.splice(index, 1, { ...current, isDone });
		}
		return Promise.resolve();
	}
}

class FakeLinkRepository implements KanbanLinkRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public conflictsWith(link: KanbanStoredLink): Promise<boolean> {
		return Promise.resolve(
			this.store.links.some(
				(row) =>
					!row.isDeleted &&
					row.kind === link.kind &&
					((row.sourceTaskId === link.sourceTaskId && row.targetTaskId === link.targetTaskId) ||
						(row.sourceTaskId === link.targetTaskId && row.targetTaskId === link.sourceTaskId)),
			),
		);
	}

	public create(id: string, link: KanbanStoredLink): Promise<void> {
		this.store.links.push({ id, ...link, isDeleted: false });
		return Promise.resolve();
	}

	public findLiveOfTask(taskId: string, linkId: string): Promise<KanbanLinkRecord | null> {
		const row = this.store.links.find(
			(candidate) => candidate.id === linkId && !candidate.isDeleted && (candidate.sourceTaskId === taskId || candidate.targetTaskId === taskId),
		);
		return Promise.resolve(row === undefined ? null : { id: row.id, sourceTaskId: row.sourceTaskId, targetTaskId: row.targetTaskId, kind: row.kind });
	}

	public softDelete(linkId: string): Promise<void> {
		for (const row of this.store.links) {
			if (row.id === linkId) {
				row.isDeleted = true;
			}
		}
		return Promise.resolve();
	}
}

class FakeWatcherRepository implements KanbanWatcherRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public isWatching(taskId: string, userId: string): Promise<boolean> {
		return Promise.resolve(this.store.watchers.some((row) => row.taskId === taskId && row.userId === userId && !row.isDeleted));
	}

	public watch(id: string, taskId: string, userId: string): Promise<void> {
		this.store.watchers.push({ id, taskId, userId, isDeleted: false });
		return Promise.resolve();
	}

	public unwatch(taskId: string, userId: string): Promise<boolean> {
		const row = this.store.watchers.find((candidate) => candidate.taskId === taskId && candidate.userId === userId && !candidate.isDeleted);
		if (row !== undefined) {
			row.isDeleted = true;
		}
		return Promise.resolve(row !== undefined);
	}
}

class FakeActivityRepository implements KanbanActivityRepository {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public append(entries: readonly NewKanbanActivity[]): Promise<void> {
		this.store.activity.push(...entries);
		return Promise.resolve();
	}
}

class FakePeopleRepository implements KanbanPeopleRepository {
	public namesOf(userIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(new Map(userIds.flatMap((userId): [string, string][] => (STAFF_NAMES.has(userId) ? [[userId, STAFF_NAMES.get(userId) ?? userId]] : []))));
	}
}

/** The files lock: the live files of the category (and uploader) the request names, like the real port. */
class FakeFileReferences implements FileReferencePort {
	public constructor(private readonly store: InMemoryKanbanStore) {}

	public lockForBinding(request: FileBindingRequest): Promise<readonly BindableFile[]> {
		return Promise.resolve(
			request.fileIds.flatMap((id): BindableFile[] => {
				const file = this.store.files.get(id);
				if (file?.category !== request.category || (request.uploadedById !== null && file.uploadedById !== request.uploadedById)) {
					return [];
				}
				return [file];
			}),
		);
	}
}

export function fakeKanbanScope(store: InMemoryKanbanStore): KanbanScope {
	return {
		board: new FakeBoardRepository(store),
		tasks: new FakeTaskRepository(store),
		keys: new FakeKeyRepository(store),
		comments: new FakeCommentRepository(store),
		attachments: new FakeAttachmentRepository(store),
		checklist: new FakeChecklistRepository(store),
		links: new FakeLinkRepository(store),
		watchers: new FakeWatcherRepository(store),
		activity: new FakeActivityRepository(store),
		people: new FakePeopleRepository(),
		files: new FakeFileReferences(store),
		events: new TransactionalEventCollector(),
	};
}

/**
 * Hands out the given ids in order, so a test knows the id a handler creates
 * first; after them, `generated-1`, `generated-2`, … for the rows a test does
 * not name (watches, history).
 */
export class SequenceIdGenerator implements KanbanIdGenerator {
	private cursor = 0;

	public constructor(private readonly ids: readonly string[]) {}

	public next(): string {
		const id = this.ids.at(this.cursor) ?? `generated-${String(this.cursor - this.ids.length + 1)}`;
		this.cursor += 1;
		return id;
	}
}

/** The people the authorization context would let the board assign; it records who asked. */
export class FakeKanbanAssignees implements KanbanAssigneesPort {
	public readonly asked: ActorContext[] = [];

	public constructor(private readonly assignable: readonly string[] = [STAFF_ID, OTHER_STAFF_ID]) {}

	public assignableUserIds(actor: ActorContext): Promise<readonly string[]> {
		this.asked.push(actor);
		return Promise.resolve(this.assignable);
	}
}
