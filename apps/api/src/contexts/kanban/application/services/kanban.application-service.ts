import { Inject, Injectable } from "@nestjs/common";
import type {
	KanbanActivity,
	KanbanActivityListQuery,
	KanbanBoard,
	KanbanBoardKind,
	KanbanComment,
	KanbanCommentListQuery,
	KanbanItemListQuery,
	KanbanItemSummary,
	KanbanSearchQuery,
	KanbanSearchResults,
	KanbanTaskDetail,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { KanbanTaskNotFoundError } from "../../domain/errors/kanban.errors";
import type { KanbanReadPort } from "../ports/kanban-read.port";
import { KANBAN_READS } from "../ports/kanban.tokens";

/** The staff's reads of the two kanban boards (ADR 096). A task that does not exist, or is not visible, is a 404. */
@Injectable()
export class KanbanApplicationService {
	public constructor(@Inject(KANBAN_READS) private readonly reads: KanbanReadPort) {}

	/** One board with its columns and cards. */
	public board(actor: ActorContext, board: KanbanBoardKind): Promise<KanbanBoard> {
		return this.reads.board(actor, board);
	}

	/** One page of the hierarchy's items. */
	public listItems(actor: ActorContext, input: KanbanItemListQuery): Promise<PaginatedServiceResult<KanbanItemSummary>> {
		return this.reads.items(actor, input);
	}

	/** Items whose key or title matches. */
	public search(actor: ActorContext, input: KanbanSearchQuery): Promise<KanbanSearchResults> {
		return this.reads.search(actor, input);
	}

	public async task(actor: ActorContext, taskId: string): Promise<KanbanTaskDetail> {
		const task = await this.reads.task(actor, taskId);
		if (task === null) {
			throw new KanbanTaskNotFoundError(taskId);
		}
		return task;
	}

	public async comments(actor: ActorContext, taskId: string, input: KanbanCommentListQuery): Promise<PaginatedServiceResult<KanbanComment>> {
		const page = await this.reads.comments(actor, taskId, input);
		if (page === null) {
			throw new KanbanTaskNotFoundError(taskId);
		}
		return page;
	}

	public async activity(actor: ActorContext, taskId: string, input: KanbanActivityListQuery): Promise<PaginatedServiceResult<KanbanActivity>> {
		const page = await this.reads.activity(actor, taskId, input);
		if (page === null) {
			throw new KanbanTaskNotFoundError(taskId);
		}
		return page;
	}
}
