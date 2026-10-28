import { Controller, Delete, Get, HttpStatus, Patch, Post, Put } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	AttachKanbanFileSchema,
	CreateKanbanCommentSchema,
	CreateKanbanLinkSchema,
	CreateKanbanTaskSchema,
	DeleteSuccessDataSchema,
	ImportKanbanTasksSchema,
	KanbanActivityListQuerySchema,
	KanbanActivitySchema,
	KanbanAttachmentDownloadSchema,
	KanbanAttachmentPathSchema,
	KanbanAttachmentSchema,
	KanbanBoardQuerySchema,
	KanbanBoardSchema,
	KanbanChecklistItemPathSchema,
	KanbanColumnPathSchema,
	KanbanCommentListQuerySchema,
	KanbanCommentSchema,
	KanbanItemListQuerySchema,
	KanbanItemSummarySchema,
	KanbanLinkPathSchema,
	KanbanPeopleSchema,
	KanbanSearchQuerySchema,
	KanbanSearchResultsSchema,
	KanbanTaskDetailSchema,
	KanbanTaskPathSchema,
	MoveKanbanColumnSchema,
	MoveKanbanItemToParentSchema,
	MoveKanbanTaskSchema,
	SetKanbanChecklistItemSchema,
	UpdateKanbanColumnSchema,
	UpdateKanbanTaskSchema,
	type AttachKanbanFileInput,
	type CreateKanbanCommentInput,
	type CreateKanbanLinkInput,
	type CreateKanbanTaskInput,
	type DeleteSuccessData,
	type ImportKanbanTasksInput,
	type KanbanActivity,
	type KanbanActivityListQuery,
	type KanbanAttachment,
	type KanbanAttachmentDownload,
	type KanbanAttachmentPath,
	type KanbanBoard,
	type KanbanBoardQuery,
	type KanbanChecklistItemPath,
	type KanbanColumnPath,
	type KanbanComment,
	type KanbanCommentListQuery,
	type KanbanItemListQuery,
	type KanbanItemSummary,
	type KanbanLinkPath,
	type KanbanPeople,
	type KanbanSearchQuery,
	type KanbanSearchResults,
	type KanbanTaskDetail,
	type KanbanTaskPath,
	type MoveKanbanColumnInput,
	type MoveKanbanItemToParentInput,
	type MoveKanbanTaskInput,
	type PaginatedServiceResult,
	type SetKanbanChecklistItemInput,
	type UpdateKanbanColumnInput,
	type UpdateKanbanTaskInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { Idempotent } from "../../../../platform/presentation/http/idempotency/idempotent.decorator";
import { AdminAccessOnly } from "../../../../platform/presentation/http/security/decorators/admin-access.decorator";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { PlatformOperation } from "../../../../platform/presentation/http/security/decorators/platform-operation.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodListQuery, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { AddKanbanCommentCommand } from "../../application/commands/add-kanban-comment/add-kanban-comment.command";
import { AddKanbanLinkCommand } from "../../application/commands/add-kanban-link/add-kanban-link.command";
import { AttachKanbanFileCommand } from "../../application/commands/attach-kanban-file/attach-kanban-file.command";
import { CreateKanbanTaskCommand } from "../../application/commands/create-kanban-task/create-kanban-task.command";
import { DeleteKanbanTaskCommand } from "../../application/commands/delete-kanban-task/delete-kanban-task.command";
import { ImportKanbanTasksCommand } from "../../application/commands/import-kanban-tasks/import-kanban-tasks.command";
import { MoveKanbanColumnCommand } from "../../application/commands/move-kanban-column/move-kanban-column.command";
import { MoveKanbanItemToParentCommand } from "../../application/commands/move-kanban-item-to-parent/move-kanban-item-to-parent.command";
import { MoveKanbanTaskCommand } from "../../application/commands/move-kanban-task/move-kanban-task.command";
import { RemoveKanbanAttachmentCommand } from "../../application/commands/remove-kanban-attachment/remove-kanban-attachment.command";
import { RemoveKanbanLinkCommand } from "../../application/commands/remove-kanban-link/remove-kanban-link.command";
import { ReviseKanbanTaskCommand } from "../../application/commands/revise-kanban-task/revise-kanban-task.command";
import { SetKanbanChecklistItemCommand } from "../../application/commands/set-kanban-checklist-item/set-kanban-checklist-item.command";
import { UpdateKanbanColumnCommand } from "../../application/commands/update-kanban-column/update-kanban-column.command";
import { WatchKanbanTaskCommand } from "../../application/commands/watch-kanban-task/watch-kanban-task.command";
import { KANBAN_READ_OPERATION, KANBAN_WRITE_OPERATION } from "../../application/ports/kanban.tokens";
import { GetKanbanAttachmentDownloadQuery } from "../../application/queries/get-kanban-attachment-download/get-kanban-attachment-download.query";
import { GetKanbanBoardQuery } from "../../application/queries/get-kanban-board/get-kanban-board.query";
import { GetKanbanTaskQuery } from "../../application/queries/get-kanban-task/get-kanban-task.query";
import { ListKanbanActivityQuery } from "../../application/queries/list-kanban-activity/list-kanban-activity.query";
import { ListKanbanCommentsQuery } from "../../application/queries/list-kanban-comments/list-kanban-comments.query";
import { ListKanbanItemsQuery } from "../../application/queries/list-kanban-items/list-kanban-items.query";
import { ListKanbanPeopleQuery } from "../../application/queries/list-kanban-people/list-kanban-people.query";
import { SearchKanbanItemsQuery } from "../../application/queries/search-kanban-items/search-kanban-items.query";

/**
 * The platform staff's two linked kanban boards (planning: epics and features;
 * execution: stories, tasks and subtasks). Admin-panel sessions only, and every route is
 * gated by one `KANBAN_TASK` permission (LIST a board or a lookup, READ an item
 * or watch it, CREATE / UPDATE / DELETE items, UPDATE KANBAN_BOARD to rearrange the columns) and runs
 * under a named platform operation, because the boards' tables are bypass-only under RLS.
 */
@ApiTags("Kanban")
@ApiBearerAuth()
@AdminAccessOnly("Admin access required for the kanban board.")
@Controller(apiPath("/admin/kanban"))
export class KanbanController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RequirePermission("LIST", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("board")
	@ApiOperation({ summary: "One board: its columns left to right, each with its items top to bottom" })
	@ZodResponse(KanbanBoardSchema, { description: "The board" })
	public board(@CurrentActor() actor: ActorContext, @ZodQuery(KanbanBoardQuerySchema) query: KanbanBoardQuery): Promise<KanbanBoard> {
		return this.queryBus.execute(new GetKanbanBoardQuery(actor, query.board));
	}

	@RequirePermission("LIST", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("people")
	@ApiOperation({ summary: "Everyone an item or a subtask can be assigned to (holds READ on KANBAN_TASK), by name" })
	@ZodResponse(KanbanPeopleSchema, { description: "The people" })
	public people(@CurrentActor() actor: ActorContext): Promise<KanbanPeople> {
		return this.queryBus.execute(new ListKanbanPeopleQuery(actor));
	}

	@RequirePermission("LIST", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("items")
	@ApiOperation({ summary: "Live items of either board, by type and title (a parent or link picker), paginated" })
	@ZodPaginatedResponse(KanbanItemSummarySchema, { description: "One page of items" })
	public items(@CurrentActor() actor: ActorContext, @ZodListQuery(KanbanItemListQuerySchema) query: KanbanItemListQuery): Promise<PaginatedServiceResult<KanbanItemSummary>> {
		return this.queryBus.execute(new ListKanbanItemsQuery(actor, query));
	}

	@RequirePermission("LIST", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("search")
	@ApiOperation({ summary: "Live items ranked for a lookup: the exact key first, then keys that start with the text, then titles that contain it" })
	@ZodResponse(KanbanSearchResultsSchema, { description: "The best matches, best first" })
	public search(@CurrentActor() actor: ActorContext, @ZodQuery(KanbanSearchQuerySchema) query: KanbanSearchQuery): Promise<KanbanSearchResults> {
		return this.queryBus.execute(new SearchKanbanItemsQuery(actor, query));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Idempotent()
	@Post("tasks")
	@ApiOperation({ summary: "Create an item at the bottom of a column of its board; the caller reports and watches it" })
	@ZodResponse(KanbanTaskDetailSchema, { status: HttpStatus.CREATED, description: "The created task" })
	public createTask(@CurrentActor() actor: ActorContext, @ZodBody(CreateKanbanTaskSchema) body: CreateKanbanTaskInput): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new CreateKanbanTaskCommand(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("CREATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Idempotent()
	@Post("tasks/import")
	@ApiOperation({ summary: "Create several items on one board at once (a CSV import), each at the bottom of its column; all or none. Answers that board" })
	@ZodResponse(KanbanBoardSchema, { status: HttpStatus.CREATED, description: "The board after the import" })
	public importTasks(@CurrentActor() actor: ActorContext, @ZodBody(ImportKanbanTasksSchema) body: ImportKanbanTasksInput): Promise<KanbanBoard> {
		return this.commandBus.execute(new ImportKanbanTasksCommand(actor, body));
	}

	@RequirePermission("READ", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("tasks/:taskId")
	@ApiOperation({ summary: "One item with its column, children, links, checklists, watchers and attachments" })
	@ZodResponse(KanbanTaskDetailSchema, { description: "The task" })
	public task(@CurrentActor() actor: ActorContext, @ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath): Promise<KanbanTaskDetail> {
		return this.queryBus.execute(new GetKanbanTaskQuery(actor, params.taskId));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Patch("tasks/:taskId")
	@ApiOperation({ summary: "Edit an item's fields and checklists (optimistic lock: send the version you read; 409 KANBAN_TASK_STALE otherwise)" })
	@ZodResponse(KanbanTaskDetailSchema, { description: "The edited task" })
	public updateTask(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodBody(UpdateKanbanTaskSchema) body: UpdateKanbanTaskInput,
	): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new ReviseKanbanTaskCommand(actor, params.taskId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("DELETE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Delete("tasks/:taskId")
	@ApiOperation({ summary: "Soft-delete an item with no live children; the items below it move up" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Task deleted" })
	public async deleteTask(@CurrentActor() actor: ActorContext, @ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath): Promise<DeleteSuccessData> {
		await this.commandBus.execute(new DeleteKanbanTaskCommand(actor, params.taskId));
		return { success: true };
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Post("tasks/:taskId/move")
	@ApiOperation({ summary: "Move an item into a column of its board, right below another item (or to the top); answers that board" })
	@ZodResponse(KanbanBoardSchema, { status: HttpStatus.CREATED, description: "The board after the move" })
	public moveTask(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodBody(MoveKanbanTaskSchema) body: MoveKanbanTaskInput,
	): Promise<KanbanBoard> {
		return this.commandBus.execute(new MoveKanbanTaskCommand(actor, params.taskId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Post("tasks/:taskId/parent")
	@ApiOperation({
		summary: "Move to…: put an item under another parent one level up; it keeps its column and place",
		description: "Send the item `version` you read (409 KANBAN_TASK_STALE otherwise). The history records the old and the new parent; undo is the same call back.",
	})
	@ZodResponse(KanbanTaskDetailSchema, { status: HttpStatus.CREATED, description: "The item under its new parent" })
	public moveToParent(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodBody(MoveKanbanItemToParentSchema) body: MoveKanbanItemToParentInput,
	): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new MoveKanbanItemToParentCommand(actor, params.taskId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_BOARD")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Post("columns/:columnId/move")
	@ApiOperation({ summary: "Move a column right of another on its board (or first); answers that board" })
	@ZodResponse(KanbanBoardSchema, { status: HttpStatus.CREATED, description: "The board after the move" })
	public moveColumn(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanColumnPathSchema) params: KanbanColumnPath,
		@ZodBody(MoveKanbanColumnSchema) body: MoveKanbanColumnInput,
	): Promise<KanbanBoard> {
		return this.commandBus.execute(new MoveKanbanColumnCommand(actor, params.columnId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_BOARD")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Patch("columns/:columnId")
	@ApiOperation({ summary: "Set or clear a column's soft WIP limit (optimistic lock: send the version you read); answers that board" })
	@ZodResponse(KanbanBoardSchema, { description: "The board after the edit" })
	public updateColumn(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanColumnPathSchema) params: KanbanColumnPath,
		@ZodBody(UpdateKanbanColumnSchema) body: UpdateKanbanColumnInput,
	): Promise<KanbanBoard> {
		return this.commandBus.execute(new UpdateKanbanColumnCommand(actor, params.columnId, body));
	}

	@RequirePermission("LIST", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("tasks/:taskId/comments")
	@ApiOperation({ summary: "A task's comments, newest first (paginated)" })
	@ZodPaginatedResponse(KanbanCommentSchema, { description: "One page of comments" })
	public comments(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodListQuery(KanbanCommentListQuerySchema) query: KanbanCommentListQuery,
	): Promise<PaginatedServiceResult<KanbanComment>> {
		return this.queryBus.execute(new ListKanbanCommentsQuery(actor, params.taskId, query));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Idempotent()
	@Post("tasks/:taskId/comments")
	@ApiOperation({ summary: "Comment on a task as the signed-in staff member" })
	@ZodResponse(KanbanCommentSchema, { status: HttpStatus.CREATED, description: "The comment" })
	public addComment(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodBody(CreateKanbanCommentSchema) body: CreateKanbanCommentInput,
	): Promise<KanbanComment> {
		return this.commandBus.execute(new AddKanbanCommentCommand(actor, params.taskId, body));
	}

	@RequirePermission("READ", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("tasks/:taskId/activity")
	@ApiOperation({ summary: "An item's history, newest first (paginated)" })
	@ZodPaginatedResponse(KanbanActivitySchema, { description: "One page of history" })
	public activity(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodListQuery(KanbanActivityListQuerySchema) query: KanbanActivityListQuery,
	): Promise<PaginatedServiceResult<KanbanActivity>> {
		return this.queryBus.execute(new ListKanbanActivityQuery(actor, params.taskId, query));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Post("tasks/:taskId/links")
	@ApiOperation({ summary: "Link the item to another live item (blocks, blocked by, relates to); 409 when already linked. Answers the item" })
	@ZodResponse(KanbanTaskDetailSchema, { status: HttpStatus.CREATED, description: "The item with its new link" })
	public addLink(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodBody(CreateKanbanLinkSchema) body: CreateKanbanLinkInput,
	): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new AddKanbanLinkCommand(actor, params.taskId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Delete("tasks/:taskId/links/:linkId")
	@ApiOperation({ summary: "Remove one of the item's links (either end); answers the item" })
	@ZodResponse(KanbanTaskDetailSchema, { description: "The item without the link" })
	public removeLink(@CurrentActor() actor: ActorContext, @ZodParams(KanbanLinkPathSchema) params: KanbanLinkPath): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new RemoveKanbanLinkCommand(actor, params.taskId, params.linkId));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Patch("tasks/:taskId/checklist/:itemId")
	@ApiOperation({ summary: "Tick a subtask or an acceptance criterion off, or on again (a set, safe to retry); answers the item" })
	@ZodResponse(KanbanTaskDetailSchema, { description: "The item" })
	public setChecklistItem(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanChecklistItemPathSchema) params: KanbanChecklistItemPath,
		@ZodBody(SetKanbanChecklistItemSchema) body: SetKanbanChecklistItemInput,
	): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new SetKanbanChecklistItemCommand(actor, params.taskId, params.itemId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("READ", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Put("tasks/:taskId/watch")
	@ApiOperation({ summary: "Watch the item as the signed-in staff member (idempotent); answers the item" })
	@ZodResponse(KanbanTaskDetailSchema, { description: "The item" })
	public watch(@CurrentActor() actor: ActorContext, @ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new WatchKanbanTaskCommand(actor, params.taskId, true));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("READ", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Delete("tasks/:taskId/watch")
	@ApiOperation({ summary: "Stop watching the item (idempotent); answers the item" })
	@ZodResponse(KanbanTaskDetailSchema, { description: "The item" })
	public unwatch(@CurrentActor() actor: ActorContext, @ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath): Promise<KanbanTaskDetail> {
		return this.commandBus.execute(new WatchKanbanTaskCommand(actor, params.taskId, false));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Idempotent()
	@Post("tasks/:taskId/attachments")
	@ApiOperation({ summary: "Attach a READY KANBAN_TASK_ATTACHMENT file the caller uploaded (POST /files/upload-url)" })
	@ZodResponse(KanbanAttachmentSchema, { status: HttpStatus.CREATED, description: "The attachment" })
	public attachFile(
		@CurrentActor() actor: ActorContext,
		@ZodParams(KanbanTaskPathSchema) params: KanbanTaskPath,
		@ZodBody(AttachKanbanFileSchema) body: AttachKanbanFileInput,
	): Promise<KanbanAttachment> {
		return this.commandBus.execute(new AttachKanbanFileCommand(actor, params.taskId, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("UPDATE", "KANBAN_TASK")
	@PlatformOperation(KANBAN_WRITE_OPERATION)
	@Delete("tasks/:taskId/attachments/:attachmentId")
	@ApiOperation({ summary: "Remove an attachment: its file is deleted and its stored copy purged" })
	@ZodResponse(DeleteSuccessDataSchema, { description: "Attachment removed" })
	public async removeAttachment(@CurrentActor() actor: ActorContext, @ZodParams(KanbanAttachmentPathSchema) params: KanbanAttachmentPath): Promise<DeleteSuccessData> {
		await this.commandBus.execute(new RemoveKanbanAttachmentCommand(actor, params.taskId, params.attachmentId));
		return { success: true };
	}

	@RequirePermission("READ", "KANBAN_TASK")
	@PlatformOperation(KANBAN_READ_OPERATION)
	@Get("tasks/:taskId/attachments/:attachmentId/download")
	@ApiOperation({ summary: "A short-lived signed URL that downloads an attachment's original upload" })
	@ZodResponse(KanbanAttachmentDownloadSchema, { description: "Signed download URL of the attachment" })
	public attachmentDownload(@CurrentActor() actor: ActorContext, @ZodParams(KanbanAttachmentPathSchema) params: KanbanAttachmentPath): Promise<KanbanAttachmentDownload> {
		return this.queryBus.execute(new GetKanbanAttachmentDownloadQuery(actor, params.taskId, params.attachmentId));
	}
}
