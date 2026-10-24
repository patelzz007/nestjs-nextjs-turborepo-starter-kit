// API contract leaves owned by the `kanban` context. Composed into `apiContract`
// (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { DeleteSuccessDataSchema } from "../../schemas/api/api-response";
import { kanbanRoutes } from "./routes";
import {
	AttachKanbanFileSchema,
	CreateKanbanCommentSchema,
	CreateKanbanLinkSchema,
	CreateKanbanTaskSchema,
	ImportKanbanTasksSchema,
	KanbanActivitySchema,
	KanbanAttachmentDownloadSchema,
	KanbanAttachmentPathSchema,
	KanbanAttachmentSchema,
	KanbanBoardQuerySchema,
	KanbanBoardSchema,
	KanbanChecklistItemPathSchema,
	KanbanColumnPathSchema,
	KanbanCommentSchema,
	KanbanItemListQuerySchema,
	KanbanItemSummarySchema,
	KanbanLinkPathSchema,
	KanbanPeopleSchema,
	KanbanSearchQuerySchema,
	KanbanSearchResultsSchema,
	KanbanTaskActivityQuerySchema,
	KanbanTaskCommentsQuerySchema,
	KanbanTaskDetailSchema,
	KanbanTaskPathSchema,
	MoveKanbanColumnSchema,
	MoveKanbanItemToParentSchema,
	MoveKanbanTaskSchema,
	SetKanbanChecklistItemSchema,
	UpdateKanbanColumnSchema,
	UpdateKanbanTaskSchema,
} from "./schemas/kanban";

/** Contract leaves composed into `apiContract.kanban`. */
export const kanbanContract = {
	board: defineContract({ method: "GET", path: kanbanRoutes.board, input: KanbanBoardQuerySchema, response: singleResponse(KanbanBoardSchema) }),
	people: defineContract({ method: "GET", path: kanbanRoutes.people, input: z.undefined(), response: singleResponse(KanbanPeopleSchema) }),
	items: defineContract({ method: "GET", path: kanbanRoutes.items, input: KanbanItemListQuerySchema, response: paginatedResponse(KanbanItemSummarySchema) }),
	search: defineContract({ method: "GET", path: kanbanRoutes.search, input: KanbanSearchQuerySchema, response: singleResponse(KanbanSearchResultsSchema) }),
	createTask: defineContract({ method: "POST", path: kanbanRoutes.createTask, input: CreateKanbanTaskSchema, response: singleResponse(KanbanTaskDetailSchema) }),
	importTasks: defineContract({ method: "POST", path: kanbanRoutes.importTasks, input: ImportKanbanTasksSchema, response: singleResponse(KanbanBoardSchema) }),
	task: defineContract({ method: "GET", path: kanbanRoutes.task, input: KanbanTaskPathSchema, response: singleResponse(KanbanTaskDetailSchema) }),
	updateTask: defineContract({
		method: "PATCH",
		path: kanbanRoutes.updateTask,
		input: z.intersection(KanbanTaskPathSchema, UpdateKanbanTaskSchema),
		response: singleResponse(KanbanTaskDetailSchema),
	}),
	deleteTask: defineContract({ method: "DELETE", path: kanbanRoutes.deleteTask, input: KanbanTaskPathSchema, response: singleResponse(DeleteSuccessDataSchema) }),
	moveTask: defineContract({
		method: "POST",
		path: kanbanRoutes.moveTask,
		input: z.intersection(KanbanTaskPathSchema, MoveKanbanTaskSchema),
		response: singleResponse(KanbanBoardSchema),
	}),
	moveToParent: defineContract({
		method: "POST",
		path: kanbanRoutes.moveToParent,
		input: z.intersection(KanbanTaskPathSchema, MoveKanbanItemToParentSchema),
		response: singleResponse(KanbanTaskDetailSchema),
	}),
	moveColumn: defineContract({
		method: "POST",
		path: kanbanRoutes.moveColumn,
		input: z.intersection(KanbanColumnPathSchema, MoveKanbanColumnSchema),
		response: singleResponse(KanbanBoardSchema),
	}),
	updateColumn: defineContract({
		method: "PATCH",
		path: kanbanRoutes.updateColumn,
		input: z.intersection(KanbanColumnPathSchema, UpdateKanbanColumnSchema),
		response: singleResponse(KanbanBoardSchema),
	}),
	comments: defineContract({ method: "GET", path: kanbanRoutes.comments, input: KanbanTaskCommentsQuerySchema, response: paginatedResponse(KanbanCommentSchema) }),
	addComment: defineContract({
		method: "POST",
		path: kanbanRoutes.addComment,
		input: z.intersection(KanbanTaskPathSchema, CreateKanbanCommentSchema),
		response: singleResponse(KanbanCommentSchema),
	}),
	activity: defineContract({ method: "GET", path: kanbanRoutes.activity, input: KanbanTaskActivityQuerySchema, response: paginatedResponse(KanbanActivitySchema) }),
	addLink: defineContract({
		method: "POST",
		path: kanbanRoutes.addLink,
		input: z.intersection(KanbanTaskPathSchema, CreateKanbanLinkSchema),
		response: singleResponse(KanbanTaskDetailSchema),
	}),
	removeLink: defineContract({ method: "DELETE", path: kanbanRoutes.removeLink, input: KanbanLinkPathSchema, response: singleResponse(KanbanTaskDetailSchema) }),
	setChecklistItem: defineContract({
		method: "PATCH",
		path: kanbanRoutes.setChecklistItem,
		input: z.intersection(KanbanChecklistItemPathSchema, SetKanbanChecklistItemSchema),
		response: singleResponse(KanbanTaskDetailSchema),
	}),
	watch: defineContract({ method: "PUT", path: kanbanRoutes.watch, input: KanbanTaskPathSchema, response: singleResponse(KanbanTaskDetailSchema) }),
	unwatch: defineContract({ method: "DELETE", path: kanbanRoutes.unwatch, input: KanbanTaskPathSchema, response: singleResponse(KanbanTaskDetailSchema) }),
	attachFile: defineContract({
		method: "POST",
		path: kanbanRoutes.attachFile,
		input: z.intersection(KanbanTaskPathSchema, AttachKanbanFileSchema),
		response: singleResponse(KanbanAttachmentSchema),
	}),
	removeAttachment: defineContract({
		method: "DELETE",
		path: kanbanRoutes.removeAttachment,
		input: KanbanAttachmentPathSchema,
		response: singleResponse(DeleteSuccessDataSchema),
	}),
	attachmentDownload: defineContract({
		method: "GET",
		path: kanbanRoutes.attachmentDownload,
		input: KanbanAttachmentPathSchema,
		response: singleResponse(KanbanAttachmentDownloadSchema),
	}),
};
