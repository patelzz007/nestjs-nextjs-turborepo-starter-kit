import type { Prisma } from "@prisma/client";
import {
	DocumentMimeTypeSchema,
	epochMs,
	kanbanActivityListQuery,
	type EpochMs,
	kanbanCommentListQuery,
	kanbanItemListQuery,
	type KanbanActivity,
	type KanbanActivityListQuery,
	type KanbanActivityListSortField,
	type KanbanAncestor,
	type KanbanAttachment,
	type KanbanBoard,
	type KanbanBoardKind,
	type KanbanColumnSummary,
	type KanbanComment,
	type KanbanCommentListQuery,
	type KanbanCommentListSortField,
	type KanbanItemListQuery,
	type KanbanItemListSortField,
	type KanbanItemRef,
	type KanbanItemSummary,
	type KanbanLink,
	type KanbanPerson,
	type KanbanRollup,
	type KanbanSearchQuery,
	type KanbanSearchResult,
	type KanbanSearchResults,
	type KanbanTally,
	type KanbanTask,
	type KanbanTaskCounts,
	type KanbanTaskDetail,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { KanbanAttachedFile, KanbanReadPort } from "../../application/ports/kanban-read.port";
import { KANBAN_READ_OPERATION } from "../../application/ports/kanban.tokens";
import { linkAsSeenBy } from "../../domain/policies/kanban-link.policy";
import { rankSearchCandidates } from "../../domain/services/kanban-search-ranking";
import { computeRollups, NO_ROLLUP } from "./kanban-rollups";

const PERSON_SELECT = { id: true, fullName: true } satisfies Prisma.UserSelect;

/** A picker's search matches titles whatever their case. */
const CASE_INSENSITIVE: Prisma.QueryMode = "insensitive";

/** A live attachment counts only while its file is live and READY. */
const LIVE_ATTACHMENT_WHERE = { isDeleted: false, file: { isDeleted: false, status: "READY" } } satisfies Prisma.KanbanTaskAttachmentWhereInput;

/** One ancestor: what a card names it by, and the dates a task or subtask inherits from its story. */
const ANCESTOR_SELECT = { id: true, key: true, type: true, title: true, startAt: true, dueAt: true, isDeleted: true } satisfies Prisma.KanbanTaskSelect;

/** The whole parent chain: a subtask's task, story, feature and epic (four levels at most). */
const PARENT_CHAIN_SELECT = {
	select: { ...ANCESTOR_SELECT, parent: { select: { ...ANCESTOR_SELECT, parent: { select: { ...ANCESTOR_SELECT, parent: { select: ANCESTOR_SELECT } } } } } },
} satisfies Prisma.KanbanTaskDefaultArgs;

/** An item sits in a column of one of the two boards; an item the conversion has not placed yet is on neither and is never read. */
const PLACED_WHERE = { OR: [{ planningColumnId: { not: null } }, { executionColumnId: { not: null } }] } satisfies Prisma.KanbanTaskWhereInput;
const LIVE_PLACED_WHERE = { isDeleted: false, ...PLACED_WHERE } satisfies Prisma.KanbanTaskWhereInput;

/** The column an item sits in, read from whichever of the two tables holds it. */
const PLACEMENT_SELECT = {
	planningColumn: { select: { id: true, title: true, stage: true } },
	executionColumn: { select: { id: true, title: true, state: true } },
} satisfies Prisma.KanbanTaskSelect;

/**
 * What a card shows. Its parent chain and its comment count come back with the
 * row: one statement per relation level for the whole board, never a query per card.
 */
const TASK_CARD_SELECT = {
	id: true,
	key: true,
	planningColumnId: true,
	executionColumnId: true,
	type: true,
	title: true,
	description: true,
	priority: true,
	team: true,
	labels: true,
	parentId: true,
	startAt: true,
	dueAt: true,
	storyPoints: true,
	progress: true,
	version: true,
	createdAt: true,
	updatedAt: true,
	owner: { select: PERSON_SELECT },
	assignee: { select: PERSON_SELECT },
	parent: PARENT_CHAIN_SELECT,
	_count: { select: { comments: { where: { isDeleted: false } } } },
} satisfies Prisma.KanbanTaskSelect;

/** An item as a list row (a child, a linked item, a picker option). */
const ITEM_SUMMARY_SELECT = {
	id: true,
	key: true,
	type: true,
	title: true,
	priority: true,
	storyPoints: true,
	assignee: { select: PERSON_SELECT },
	...PLACEMENT_SELECT,
} satisfies Prisma.KanbanTaskSelect;

/** A search result: the list row and its parent chain. */
const SEARCH_RESULT_SELECT = { ...ITEM_SUMMARY_SELECT, createdAt: true, parent: PARENT_CHAIN_SELECT } satisfies Prisma.KanbanTaskSelect;

const ATTACHMENT_SELECT = {
	id: true,
	commentId: true,
	kind: true,
	createdAt: true,
	file: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, uploadedBy: { select: PERSON_SELECT } } },
} satisfies Prisma.KanbanTaskAttachmentSelect;

/** Live, READY files posted with a comment, in the order they were posted. */
const COMMENT_ATTACHMENT_ORDER: Prisma.KanbanTaskAttachmentOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];

/** A comment with its files: one statement per relation level for a whole page, never a query per comment. */
const COMMENT_SELECT = {
	id: true,
	taskId: true,
	body: true,
	createdAt: true,
	author: { select: PERSON_SELECT },
	attachments: { where: LIVE_ATTACHMENT_WHERE, orderBy: COMMENT_ATTACHMENT_ORDER, select: ATTACHMENT_SELECT },
} satisfies Prisma.KanbanTaskCommentSelect;

const ACTIVITY_SELECT = {
	id: true,
	taskId: true,
	kind: true,
	field: true,
	fromValue: true,
	toValue: true,
	createdAt: true,
	actor: { select: PERSON_SELECT },
} satisfies Prisma.KanbanTaskActivitySelect;

const CHECKLIST_SELECT = { id: true, list: true, title: true, depth: true, isDone: true, assignee: { select: PERSON_SELECT } } satisfies Prisma.KanbanChecklistItemSelect;

/** The two checklists an item has; rows of the retired `SUBTASKS` list are the conversion's to read. */
const LIVE_CHECKLIST_WHERE = { isDeleted: false, list: { in: ["STEPS", "ACCEPTANCE_CRITERIA"] } } satisfies Prisma.KanbanChecklistItemWhereInput;

type TaskCardRow = Prisma.KanbanTaskGetPayload<{ select: typeof TASK_CARD_SELECT }>;
type ItemSummaryRow = Prisma.KanbanTaskGetPayload<{ select: typeof ITEM_SUMMARY_SELECT }>;
type SearchResultRow = Prisma.KanbanTaskGetPayload<{ select: typeof SEARCH_RESULT_SELECT }>;
type PlacementRow = Prisma.KanbanTaskGetPayload<{ select: typeof PLACEMENT_SELECT }>;
type AttachmentRow = Prisma.KanbanTaskAttachmentGetPayload<{ select: typeof ATTACHMENT_SELECT }>;
type CommentRow = Prisma.KanbanTaskCommentGetPayload<{ select: typeof COMMENT_SELECT }>;
type ActivityRow = Prisma.KanbanTaskActivityGetPayload<{ select: typeof ACTIVITY_SELECT }>;
type ChecklistRow = Prisma.KanbanChecklistItemGetPayload<{ select: typeof CHECKLIST_SELECT }>;
type AncestorRow = Prisma.KanbanTaskGetPayload<{ select: typeof ANCESTOR_SELECT }>;

/** One link in an ancestor chain, as Prisma nests it (a parent and, maybe, its own parent). */
interface AncestorChainRow extends AncestorRow {
	readonly parent?: AncestorChainRow | null;
}

/** Live rows in board order; `id` breaks ties so the order is total. */
const PLANNING_COLUMN_ORDER: Prisma.KanbanPlanningColumnOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
const EXECUTION_COLUMN_ORDER: Prisma.KanbanExecutionColumnOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
const TASK_ORDER: Prisma.KanbanTaskOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
const CHECKLIST_ORDER: Prisma.KanbanChecklistItemOrderByWithRelationInput[] = [{ position: "asc" }, { id: "asc" }];
/** A detail page lists children by column, then place (an item's children all live on one board). */
const CHILD_ORDER: Prisma.KanbanTaskOrderByWithRelationInput[] = [
	{ executionColumn: { position: "asc" } },
	{ planningColumn: { position: "asc" } },
	{ position: "asc" },
	{ id: "asc" },
];
/** Search candidates come in creation order, so `STORY-1` precedes `STORY-12` among key-prefix matches. */
const SEARCH_ORDER: Prisma.KanbanTaskOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];
/** Newest first on the item page. */
const ATTACHMENT_ORDER: Prisma.KanbanTaskAttachmentOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

const COMMENT_SORT_COLUMNS: SortColumns<KanbanCommentListSortField, Prisma.KanbanTaskCommentOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

const ACTIVITY_SORT_COLUMNS: SortColumns<KanbanActivityListSortField, Prisma.KanbanTaskActivityOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

const ITEM_SORT_COLUMNS: SortColumns<KanbanItemListSortField, Prisma.KanbanTaskOrderByWithRelationInput> = {
	title: (direction) => ({ title: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const COMMENT_LIST_KEYSET: ListKeyset<CommentRow, Prisma.KanbanTaskCommentWhereInput> = timestampIdKeyset(
	(row: CommentRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.KanbanTaskCommentWhereInput => ({ OR: [{ createdAt: { lt: BigInt(at) } }, { createdAt: BigInt(at), id: { lt: id } }] }),
);

const ACTIVITY_LIST_KEYSET: ListKeyset<ActivityRow, Prisma.KanbanTaskActivityWhereInput> = timestampIdKeyset(
	(row: ActivityRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.KanbanTaskActivityWhereInput => ({ OR: [{ createdAt: { lt: BigInt(at) } }, { createdAt: BigInt(at), id: { lt: id } }] }),
);

/** Image attachments and PDF documents of one item. */
interface FileCounts {
	readonly attachments: number;
	readonly documents: number;
}

/** What a board read adds up for its cards, beyond the rows themselves. */
interface CardExtras {
	readonly files: ReadonlyMap<string, FileCounts>;
	readonly rollups: ReadonlyMap<string, KanbanRollup>;
	readonly steps: ReadonlyMap<string, KanbanTally>;
	readonly criteria: ReadonlyMap<string, KanbanTally>;
	readonly blocked: ReadonlySet<string>;
}

const NO_FILES: FileCounts = { attachments: 0, documents: 0 };
const NO_TALLY: KanbanTally = { done: 0, total: 0 };

function toPerson(row: { readonly id: string; readonly fullName: string }): KanbanPerson {
	return { id: row.id, name: row.fullName };
}

function toEpoch(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

/** The live parent chain, top level first (the row's `parent`, its parent, and so on). */
function ancestorsOf(row: { readonly parent: AncestorChainRow | null }): KanbanAncestor[] {
	const chain: AncestorRow[] = [];
	for (let ancestor: AncestorChainRow | null | undefined = row.parent; ancestor !== null && ancestor !== undefined; ancestor = ancestor.parent) {
		if (!ancestor.isDeleted) {
			chain.unshift(ancestor);
		}
	}
	return chain.map((ancestor) => ({
		id: ancestor.id,
		key: ancestor.key,
		type: ancestor.type,
		title: ancestor.title,
		startAt: toEpoch(ancestor.startAt),
		dueAt: toEpoch(ancestor.dueAt),
	}));
}

/** The column an item sits in. Every row these reads return is placed (`PLACED_WHERE`). */
function columnOf(row: PlacementRow): KanbanColumnSummary {
	if (row.executionColumn !== null) {
		return { ...row.executionColumn, board: "EXECUTION" };
	}
	if (row.planningColumn !== null) {
		return { ...row.planningColumn, board: "PLANNING" };
	}
	throw new Error("A kanban item is on neither board: run `pnpm db:kanban-convert`.");
}

/** The id of the column a card sits in. */
function columnIdOf(row: Pick<TaskCardRow, "planningColumnId" | "executionColumnId">): string {
	const columnId = row.executionColumnId ?? row.planningColumnId;
	if (columnId === null) {
		throw new Error("A kanban item is on neither board: run `pnpm db:kanban-convert`.");
	}
	return columnId;
}

function toCounts(row: TaskCardRow, files: FileCounts): KanbanTaskCounts {
	return { comments: row._count.comments, attachments: files.attachments, documents: files.documents };
}

function toTask(row: TaskCardRow, extras: CardExtras): KanbanTask {
	return {
		id: row.id,
		key: row.key,
		columnId: columnIdOf(row),
		type: row.type,
		title: row.title,
		description: row.description,
		priority: row.priority,
		team: row.team,
		labels: row.labels,
		parentId: row.parentId,
		ancestors: ancestorsOf(row),
		startAt: toEpoch(row.startAt),
		dueAt: toEpoch(row.dueAt),
		storyPoints: row.storyPoints,
		progress: row.progress,
		owner: toPerson(row.owner),
		assignee: row.assignee === null ? null : toPerson(row.assignee),
		rollup: extras.rollups.get(row.id) ?? NO_ROLLUP,
		steps: extras.steps.get(row.id) ?? NO_TALLY,
		acceptanceCriteria: extras.criteria.get(row.id) ?? NO_TALLY,
		isBlocked: extras.blocked.has(row.id),
		counts: toCounts(row, extras.files.get(row.id) ?? NO_FILES),
		version: row.version,
		createdAt: epochMs(Number(row.createdAt)),
		updatedAt: epochMs(Number(row.updatedAt)),
	};
}

function toItemSummary(row: ItemSummaryRow): KanbanItemSummary {
	return {
		id: row.id,
		key: row.key,
		type: row.type,
		title: row.title,
		priority: row.priority,
		storyPoints: row.storyPoints,
		assignee: row.assignee === null ? null : toPerson(row.assignee),
		column: columnOf(row),
	};
}

function toItemRef(ancestor: KanbanAncestor): KanbanItemRef {
	return { id: ancestor.id, key: ancestor.key, type: ancestor.type, title: ancestor.title };
}

function toAttachment(row: AttachmentRow): KanbanAttachment {
	return {
		id: row.id,
		fileId: row.file.id,
		commentId: row.commentId,
		kind: row.kind,
		fileName: row.file.originalName,
		// The type the files context verified at upload: parsed, never trusted as a bare string.
		mimeType: DocumentMimeTypeSchema.parse(row.file.mimeType),
		sizeBytes: row.file.sizeBytes,
		uploadedBy: toPerson(row.file.uploadedBy),
		createdAt: epochMs(Number(row.createdAt)),
	};
}

function toComment(row: CommentRow): KanbanComment {
	return {
		id: row.id,
		taskId: row.taskId,
		body: row.body,
		author: toPerson(row.author),
		attachments: row.attachments.map(toAttachment),
		createdAt: epochMs(Number(row.createdAt)),
	};
}

function toActivity(row: ActivityRow): KanbanActivity {
	return {
		id: row.id,
		taskId: row.taskId,
		kind: row.kind,
		field: row.field,
		from: row.fromValue,
		to: row.toValue,
		actor: toPerson(row.actor),
		createdAt: epochMs(Number(row.createdAt)),
	};
}

function countFiles(attachments: readonly Pick<AttachmentRow, "kind">[]): FileCounts {
	return {
		attachments: attachments.filter((attachment) => attachment.kind === "ATTACHMENT").length,
		documents: attachments.filter((attachment) => attachment.kind === "DOCUMENT").length,
	};
}

function tallyOf(rows: readonly Pick<ChecklistRow, "isDone">[]): KanbanTally {
	return { done: rows.filter((row) => row.isDone).length, total: rows.length };
}

/** The viewer behind a read, when it is a person (`isWatching` is theirs). */
function viewerIdOf(actor: ActorContext): string | null {
	return actor.kind === "user" ? actor.userId : null;
}

/**
 * {@link KanbanReadPort} over Prisma, every read under `kanban.board.read` on
 * behalf of the caller. Each read issues the same number of statements whatever
 * the number of rows it returns (ADR 059: no query per card, child, link or comment).
 */
export class PrismaKanbanReadRepository implements KanbanReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public board(actor: ActorContext, board: KanbanBoardKind): Promise<KanbanBoard> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<KanbanBoard> => {
			const tasks = { where: { isDeleted: false }, orderBy: TASK_ORDER, select: TASK_CARD_SELECT } satisfies Prisma.KanbanTaskFindManyArgs;
			if (board === "PLANNING") {
				const columns = await db.kanbanPlanningColumn.findMany({
					where: { isDeleted: false },
					orderBy: PLANNING_COLUMN_ORDER,
					select: { id: true, title: true, stage: true, version: true, tasks },
				});
				const extras = await this.cardExtras(
					db,
					columns.flatMap((column) => column.tasks.map((task) => task.id)),
				);
				return { board, columns: columns.map((column) => ({ ...column, board, tasks: column.tasks.map((task) => toTask(task, extras)) })) };
			}
			const columns = await db.kanbanExecutionColumn.findMany({
				where: { isDeleted: false },
				orderBy: EXECUTION_COLUMN_ORDER,
				select: { id: true, title: true, state: true, wipLimit: true, version: true, tasks },
			});
			const extras = await this.cardExtras(
				db,
				columns.flatMap((column) => column.tasks.map((task) => task.id)),
			);
			return { board, columns: columns.map((column) => ({ ...column, board, tasks: column.tasks.map((task) => toTask(task, extras)) })) };
		});
	}

	public task(actor: ActorContext, taskId: string): Promise<KanbanTaskDetail | null> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<KanbanTaskDetail | null> => {
			const row = await db.kanbanTask.findFirst({
				where: { id: taskId, ...LIVE_PLACED_WHERE },
				select: {
					...TASK_CARD_SELECT,
					...PLACEMENT_SELECT,
					attachments: { where: LIVE_ATTACHMENT_WHERE, orderBy: ATTACHMENT_ORDER, select: ATTACHMENT_SELECT },
					children: { where: LIVE_PLACED_WHERE, orderBy: CHILD_ORDER, select: ITEM_SUMMARY_SELECT },
					checklist: { where: LIVE_CHECKLIST_WHERE, orderBy: CHECKLIST_ORDER, select: CHECKLIST_SELECT },
					watchers: { where: { isDeleted: false, user: { isDeleted: false } }, orderBy: { createdAt: "asc" }, select: { user: { select: PERSON_SELECT } } },
					outgoingLinks: {
						where: { isDeleted: false, target: LIVE_PLACED_WHERE },
						select: { id: true, sourceTaskId: true, targetTaskId: true, kind: true, target: { select: ITEM_SUMMARY_SELECT } },
					},
					incomingLinks: {
						where: { isDeleted: false, source: LIVE_PLACED_WHERE },
						select: { id: true, sourceTaskId: true, targetTaskId: true, kind: true, source: { select: ITEM_SUMMARY_SELECT } },
					},
				},
			});
			if (row === null) {
				return null;
			}
			const [rollups, blocked] = await Promise.all([this.rollups(db), this.blockedAmong(db, [row.id])]);
			const stepRows = row.checklist.filter((item) => item.list === "STEPS");
			const criterionRows = row.checklist.filter((item) => item.list === "ACCEPTANCE_CRITERIA");
			const card = toTask(row, {
				files: new Map([[row.id, countFiles(row.attachments)]]),
				rollups,
				steps: new Map([[row.id, tallyOf(stepRows)]]),
				criteria: new Map([[row.id, tallyOf(criterionRows)]]),
				blocked,
			});
			const links: KanbanLink[] = [
				...row.outgoingLinks.map((link) => ({ id: link.id, kind: linkAsSeenBy(row.id, link).kind, item: toItemSummary(link.target) })),
				...row.incomingLinks.map((link) => ({ id: link.id, kind: linkAsSeenBy(row.id, link).kind, item: toItemSummary(link.source) })),
			];
			const watchers = row.watchers.map((watcher) => toPerson(watcher.user));
			const viewerId = viewerIdOf(actor);
			return {
				...card,
				column: columnOf(row),
				children: row.children.map(toItemSummary),
				links,
				stepItems: stepRows.map((item) => ({
					id: item.id,
					title: item.title,
					depth: item.depth,
					isDone: item.isDone,
					assignee: item.assignee === null ? null : toPerson(item.assignee),
				})),
				acceptanceCriterionItems: criterionRows.map((item) => ({ id: item.id, title: item.title, isDone: item.isDone })),
				watchers,
				isWatching: viewerId !== null && watchers.some((watcher) => watcher.id === viewerId),
				attachments: row.attachments.map(toAttachment),
			};
		});
	}

	public items(actor: ActorContext, query: KanbanItemListQuery): Promise<PaginatedServiceResult<KanbanItemSummary>> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<PaginatedServiceResult<KanbanItemSummary>> => {
			const conditions: Prisma.KanbanTaskWhereInput[] = [
				LIVE_PLACED_WHERE,
				...fieldWhere(toPrismaEqualityFilter(query.filter?.type), (type) => ({ type })),
				...(query.search === undefined ? [] : [{ title: { contains: query.search, mode: CASE_INSENSITIVE } }]),
			];
			const page = await fetchListPage(query, {
				where: { AND: conditions },
				order: buildListOrder(kanbanItemListQuery.resolveSort(query.sort), { columns: ITEM_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) }),
				and: (left: Prisma.KanbanTaskWhereInput, right: Prisma.KanbanTaskWhereInput): Prisma.KanbanTaskWhereInput => ({ AND: [left, right] }),
				count: (where) => db.kanbanTask.count({ where }),
				findMany: async (args): Promise<ItemSummaryRow[]> =>
					db.kanbanTask.findMany({
						where: args.where,
						orderBy: args.orderBy,
						take: args.take,
						...(args.skip === undefined ? {} : { skip: args.skip }),
						select: ITEM_SUMMARY_SELECT,
					}),
			});
			return toPaginatedServiceResult(mapListResult(page, toItemSummary), query);
		});
	}

	/**
	 * Three bounded statements whatever the board's size — the exact key, keys
	 * that start with the text, titles that contain it — merged best first
	 * (`rankSearchCandidates`), so a key match is never crowded out by titles.
	 */
	public search(actor: ActorContext, query: KanbanSearchQuery): Promise<KanbanSearchResults> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<KanbanSearchResults> => {
			const scope: Prisma.KanbanTaskWhereInput = { ...LIVE_PLACED_WHERE, ...(query.type === undefined ? {} : { type: query.type }) };
			const find = (where: Prisma.KanbanTaskWhereInput): Promise<SearchResultRow[]> =>
				db.kanbanTask.findMany({ where: { AND: [scope, where] }, orderBy: SEARCH_ORDER, take: query.limit, select: SEARCH_RESULT_SELECT });
			const [exact, prefix, titled] = await Promise.all([
				find({ key: { equals: query.q, mode: CASE_INSENSITIVE } }),
				find({ key: { startsWith: query.q, mode: CASE_INSENSITIVE } }),
				find({ title: { contains: query.q, mode: CASE_INSENSITIVE } }),
			]);
			const results = rankSearchCandidates([...exact, ...prefix, ...titled], query.q, query.limit).map(({ candidate, match }): KanbanSearchResult => ({
				...toItemSummary(candidate),
				ancestors: ancestorsOf(candidate).map(toItemRef),
				match,
			}));
			return { results };
		});
	}

	public people(actor: ActorContext, userIds: readonly string[]): Promise<readonly KanbanPerson[]> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<readonly KanbanPerson[]> => {
			if (userIds.length === 0) {
				return [];
			}
			const users = await db.user.findMany({ where: { id: { in: [...userIds] }, isDeleted: false }, orderBy: [{ fullName: "asc" }, { id: "asc" }], select: PERSON_SELECT });
			return users.map(toPerson);
		});
	}

	public comments(actor: ActorContext, taskId: string, query: KanbanCommentListQuery): Promise<PaginatedServiceResult<KanbanComment> | null> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<PaginatedServiceResult<KanbanComment> | null> => {
			if ((await db.kanbanTask.count({ where: { id: taskId, isDeleted: false } })) === 0) {
				return null;
			}
			const page = await fetchListPage(query, {
				where: { taskId, isDeleted: false },
				order: buildListOrder(kanbanCommentListQuery.resolveSort(query.sort), { columns: COMMENT_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) }),
				keyset: COMMENT_LIST_KEYSET,
				and: (left: Prisma.KanbanTaskCommentWhereInput, right: Prisma.KanbanTaskCommentWhereInput): Prisma.KanbanTaskCommentWhereInput => ({ AND: [left, right] }),
				count: (where) => db.kanbanTaskComment.count({ where }),
				findMany: async (args): Promise<CommentRow[]> =>
					db.kanbanTaskComment.findMany({
						where: args.where,
						orderBy: args.orderBy,
						take: args.take,
						...(args.skip === undefined ? {} : { skip: args.skip }),
						select: COMMENT_SELECT,
					}),
			});
			return toPaginatedServiceResult(mapListResult(page, toComment), query);
		});
	}

	public comment(actor: ActorContext, commentId: string): Promise<KanbanComment | null> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<KanbanComment | null> => {
			const row = await db.kanbanTaskComment.findFirst({ where: { id: commentId, isDeleted: false }, select: COMMENT_SELECT });
			return row === null ? null : toComment(row);
		});
	}

	public activity(actor: ActorContext, taskId: string, query: KanbanActivityListQuery): Promise<PaginatedServiceResult<KanbanActivity> | null> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<PaginatedServiceResult<KanbanActivity> | null> => {
			if ((await db.kanbanTask.count({ where: { id: taskId, isDeleted: false } })) === 0) {
				return null;
			}
			const page = await fetchListPage(query, {
				where: { taskId, isDeleted: false },
				order: buildListOrder(kanbanActivityListQuery.resolveSort(query.sort), { columns: ACTIVITY_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) }),
				keyset: ACTIVITY_LIST_KEYSET,
				and: (left: Prisma.KanbanTaskActivityWhereInput, right: Prisma.KanbanTaskActivityWhereInput): Prisma.KanbanTaskActivityWhereInput => ({ AND: [left, right] }),
				count: (where) => db.kanbanTaskActivity.count({ where }),
				findMany: async (args): Promise<ActivityRow[]> =>
					db.kanbanTaskActivity.findMany({
						where: args.where,
						orderBy: args.orderBy,
						take: args.take,
						...(args.skip === undefined ? {} : { skip: args.skip }),
						select: ACTIVITY_SELECT,
					}),
			});
			return toPaginatedServiceResult(mapListResult(page, toActivity), query);
		});
	}

	public attachment(actor: ActorContext, attachmentId: string): Promise<KanbanAttachment | null> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<KanbanAttachment | null> => {
			const row = await db.kanbanTaskAttachment.findFirst({ where: { id: attachmentId, ...LIVE_ATTACHMENT_WHERE }, select: ATTACHMENT_SELECT });
			return row === null ? null : toAttachment(row);
		});
	}

	public attachedFile(actor: ActorContext, taskId: string, attachmentId: string): Promise<KanbanAttachedFile | null> {
		return this.reads.readAsSystemOperation(KANBAN_READ_OPERATION, actor, async (db): Promise<KanbanAttachedFile | null> => {
			const row = await db.kanbanTaskAttachment.findFirst({
				where: { id: attachmentId, taskId, task: { isDeleted: false }, ...LIVE_ATTACHMENT_WHERE },
				select: { id: true, file: { select: { id: true, originalName: true } } },
			});
			return row === null ? null : { attachmentId: row.id, fileId: row.file.id, fileName: row.file.originalName };
		});
	}

	/** Everything a board's cards add up, for all of them at once: four statements, whatever the number of cards. */
	private async cardExtras(db: Prisma.TransactionClient, taskIds: readonly string[]): Promise<CardExtras> {
		if (taskIds.length === 0) {
			return { files: new Map(), rollups: new Map(), steps: new Map(), criteria: new Map(), blocked: new Set() };
		}
		const [files, rollups, checklists, blocked] = await Promise.all([
			this.fileCountsByTask(db, taskIds),
			this.rollups(db),
			db.kanbanChecklistItem.groupBy({ by: ["taskId", "list", "isDone"], where: { taskId: { in: [...taskIds] }, ...LIVE_CHECKLIST_WHERE }, _count: { _all: true } }),
			this.blockedAmong(db, taskIds),
		]);
		const steps = new Map<string, KanbanTally>();
		const criteria = new Map<string, KanbanTally>();
		for (const group of checklists) {
			const tallies = group.list === "STEPS" ? steps : criteria;
			const tally = tallies.get(group.taskId) ?? NO_TALLY;
			tallies.set(group.taskId, { done: tally.done + (group.isDone ? group._count._all : 0), total: tally.total + group._count._all });
		}
		return { files, rollups, steps, criteria, blocked };
	}

	/** Every live item's rollup, from one read of the hierarchy across both boards (bounded by the column limit). */
	private async rollups(db: Prisma.TransactionClient): Promise<ReadonlyMap<string, KanbanRollup>> {
		const items = await db.kanbanTask.findMany({
			where: LIVE_PLACED_WHERE,
			select: { id: true, type: true, parentId: true, storyPoints: true, planningColumn: { select: { stage: true } }, executionColumn: { select: { state: true } } },
		});
		return computeRollups(
			items.map((item) => ({
				id: item.id,
				type: item.type,
				parentId: item.parentId,
				storyPoints: item.storyPoints,
				isDone: item.executionColumn?.state === "DONE" || item.planningColumn?.stage === "DELIVERED",
			})),
		);
	}

	/** The items among `taskIds` that a live, not-yet-done item blocks. */
	private async blockedAmong(db: Prisma.TransactionClient, taskIds: readonly string[]): Promise<ReadonlySet<string>> {
		const links = await db.kanbanTaskLink.findMany({
			where: {
				kind: "BLOCKS",
				isDeleted: false,
				targetTaskId: { in: [...taskIds] },
				source: { ...LIVE_PLACED_WHERE, NOT: { OR: [{ executionColumn: { state: "DONE" } }, { planningColumn: { stage: "DELIVERED" } }] } },
			},
			select: { targetTaskId: true },
		});
		return new Set(links.map((link) => link.targetTaskId));
	}

	/** Image and PDF counts of every item on the board, in one grouped statement. */
	private async fileCountsByTask(db: Prisma.TransactionClient, taskIds: readonly string[]): Promise<ReadonlyMap<string, FileCounts>> {
		const groups = await db.kanbanTaskAttachment.groupBy({
			by: ["taskId", "kind"],
			where: { taskId: { in: [...taskIds] }, ...LIVE_ATTACHMENT_WHERE },
			_count: { _all: true },
		});
		const byTask = new Map<string, FileCounts>();
		for (const group of groups) {
			const counts = byTask.get(group.taskId) ?? NO_FILES;
			byTask.set(
				group.taskId,
				group.kind === "DOCUMENT" ? { ...counts, documents: counts.documents + group._count._all } : { ...counts, attachments: counts.attachments + group._count._all },
			);
		}
		return byTask;
	}
}
