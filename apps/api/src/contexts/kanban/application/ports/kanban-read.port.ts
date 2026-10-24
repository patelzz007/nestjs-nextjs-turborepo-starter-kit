import type {
	KanbanActivity,
	KanbanActivityListQuery,
	KanbanAttachment,
	KanbanBoard,
	KanbanBoardKind,
	KanbanComment,
	KanbanCommentListQuery,
	KanbanItemListQuery,
	KanbanItemSummary,
	KanbanPerson,
	KanbanSearchQuery,
	KanbanSearchResults,
	KanbanTaskDetail,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** The file behind one live attachment: what a download or a removal needs. */
export interface KanbanAttachedFile {
	readonly attachmentId: string;
	readonly fileId: string;
	readonly fileName: string;
}

/** The boards' read models, read under `kanban.board.read`. `null` means the item (or attachment) is missing or deleted. */
export interface KanbanReadPort {
	board(actor: ActorContext, board: KanbanBoardKind): Promise<KanbanBoard>;
	/** The item as the actor sees it (`isWatching` is theirs). */
	task(actor: ActorContext, taskId: string): Promise<KanbanTaskDetail | null>;
	items(actor: ActorContext, query: KanbanItemListQuery): Promise<PaginatedServiceResult<KanbanItemSummary>>;
	/** Live items ranked for a lookup: exact key, key prefix, then title. */
	search(actor: ActorContext, query: KanbanSearchQuery): Promise<KanbanSearchResults>;
	/** The live accounts among `userIds`, by name. */
	people(actor: ActorContext, userIds: readonly string[]): Promise<readonly KanbanPerson[]>;
	comments(actor: ActorContext, taskId: string, query: KanbanCommentListQuery): Promise<PaginatedServiceResult<KanbanComment> | null>;
	comment(actor: ActorContext, commentId: string): Promise<KanbanComment | null>;
	activity(actor: ActorContext, taskId: string, query: KanbanActivityListQuery): Promise<PaginatedServiceResult<KanbanActivity> | null>;
	attachment(actor: ActorContext, attachmentId: string): Promise<KanbanAttachment | null>;
	attachedFile(actor: ActorContext, taskId: string, attachmentId: string): Promise<KanbanAttachedFile | null>;
}
