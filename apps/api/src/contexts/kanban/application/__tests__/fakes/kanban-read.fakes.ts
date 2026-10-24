import {
	epochMs,
	type KanbanActivity,
	type KanbanActivityListQuery,
	type KanbanAttachment,
	type KanbanBoard,
	type KanbanBoardKind,
	type KanbanComment,
	type KanbanCommentListQuery,
	type KanbanItemListQuery,
	type KanbanItemSummary,
	type KanbanPerson,
	type KanbanSearchQuery,
	type KanbanSearchResults,
	type KanbanTaskDetail,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { KanbanAttachmentFilesPort, KanbanFileDownloadLink } from "../../ports/kanban-attachment-files.port";
import type { KanbanAttachedFile, KanbanReadPort } from "../../ports/kanban-read.port";
import { STAFF_ID, STAFF_NAMES, TODO_ID } from "./kanban-scope.fakes";

const CREATED_AT = epochMs(1_792_000_000_000);

const NO_TALLY = { done: 0, total: 0 };

/** An item detail as the read model would answer it. */
export function taskDetail(id: string, version = 0): KanbanTaskDetail {
	return {
		id,
		key: "STORY-1",
		columnId: TODO_ID,
		type: "STORY",
		title: "Write the spec",
		description: "",
		priority: "MEDIUM",
		team: "BACKEND",
		labels: [],
		parentId: null,
		ancestors: [],
		startAt: null,
		dueAt: null,
		storyPoints: null,
		progress: 0,
		owner: { id: STAFF_ID, name: "Admin User" },
		assignee: null,
		rollup: { children: NO_TALLY, points: NO_TALLY },
		steps: NO_TALLY,
		acceptanceCriteria: NO_TALLY,
		isBlocked: false,
		counts: { comments: 0, attachments: 0, documents: 0 },
		version,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		column: { id: TODO_ID, board: "EXECUTION", title: "To do", state: "TODO" },
		children: [],
		links: [],
		stepItems: [],
		acceptanceCriterionItems: [],
		watchers: [],
		isWatching: false,
		attachments: [],
	};
}

/** An empty page of any list. */
export function emptyPage<T>(): PaginatedServiceResult<T> {
	return { items: [], limit: 20, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false };
}

/** A read port answering from what each test sets; it records which reads ran, as whom. */
export class FakeKanbanReads implements KanbanReadPort {
	public boardView: KanbanBoard = { board: "EXECUTION", columns: [] };
	public itemsPage: PaginatedServiceResult<KanbanItemSummary> = emptyPage();
	public searchResults: KanbanSearchResults = { results: [] };
	public activityPages = new Map<string, PaginatedServiceResult<KanbanActivity>>();
	public readonly tasks = new Map<string, KanbanTaskDetail>();
	public readonly commentViews = new Map<string, KanbanComment>();
	public readonly attachmentViews = new Map<string, KanbanAttachment>();
	public readonly attachedFiles = new Map<string, KanbanAttachedFile & { readonly taskId: string }>();
	public commentPages = new Map<string, PaginatedServiceResult<KanbanComment>>();
	public readonly asked: { readonly read: string; readonly actor: ActorContext }[] = [];

	public board(actor: ActorContext, board: KanbanBoardKind): Promise<KanbanBoard> {
		this.asked.push({ read: `board:${board}`, actor });
		return Promise.resolve(this.boardView);
	}

	public search(actor: ActorContext, query: KanbanSearchQuery): Promise<KanbanSearchResults> {
		this.asked.push({ read: `search:${query.q}`, actor });
		return Promise.resolve(this.searchResults);
	}

	public items(actor: ActorContext, query: KanbanItemListQuery): Promise<PaginatedServiceResult<KanbanItemSummary>> {
		this.asked.push({ read: `items:${query.search ?? ""}`, actor });
		return Promise.resolve(this.itemsPage);
	}

	public people(actor: ActorContext, userIds: readonly string[]): Promise<readonly KanbanPerson[]> {
		this.asked.push({ read: "people", actor });
		return Promise.resolve(userIds.flatMap((id): KanbanPerson[] => (STAFF_NAMES.has(id) ? [{ id, name: STAFF_NAMES.get(id) ?? id }] : [])));
	}

	public activity(actor: ActorContext, taskId: string, query: KanbanActivityListQuery): Promise<PaginatedServiceResult<KanbanActivity> | null> {
		this.asked.push({ read: `activity:${String(query.limit)}`, actor });
		return Promise.resolve(this.activityPages.get(taskId) ?? null);
	}

	public task(actor: ActorContext, taskId: string): Promise<KanbanTaskDetail | null> {
		this.asked.push({ read: "task", actor });
		return Promise.resolve(this.tasks.get(taskId) ?? null);
	}

	public comments(actor: ActorContext, taskId: string, query: KanbanCommentListQuery): Promise<PaginatedServiceResult<KanbanComment> | null> {
		this.asked.push({ read: `comments:${String(query.limit)}`, actor });
		return Promise.resolve(this.commentPages.get(taskId) ?? null);
	}

	public comment(actor: ActorContext, commentId: string): Promise<KanbanComment | null> {
		this.asked.push({ read: "comment", actor });
		return Promise.resolve(this.commentViews.get(commentId) ?? null);
	}

	public attachment(actor: ActorContext, attachmentId: string): Promise<KanbanAttachment | null> {
		this.asked.push({ read: "attachment", actor });
		return Promise.resolve(this.attachmentViews.get(attachmentId) ?? null);
	}

	public attachedFile(actor: ActorContext, taskId: string, attachmentId: string): Promise<KanbanAttachedFile | null> {
		this.asked.push({ read: "attachedFile", actor });
		const attached = this.attachedFiles.get(attachmentId);
		return Promise.resolve(attached?.taskId === taskId ? attached : null);
	}
}

/** The files context as the board sees it: links for live files, deletions recorded. */
export class FakeKanbanAttachmentFiles implements KanbanAttachmentFilesPort {
	public readonly liveFileIds = new Set<string>();
	public readonly deleted: { readonly fileId: string; readonly actorUserId: string }[] = [];

	public downloadLink(fileId: string): Promise<KanbanFileDownloadLink | null> {
		return Promise.resolve(this.liveFileIds.has(fileId) ? { url: `https://files.example/${fileId}`, expiresAt: epochMs(1_793_000_300_000) } : null);
	}

	public deleteFile(fileId: string, actorUserId: string): Promise<boolean> {
		if (!this.liveFileIds.delete(fileId)) {
			return Promise.resolve(false);
		}
		this.deleted.push({ fileId, actorUserId });
		return Promise.resolve(true);
	}
}
