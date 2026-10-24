// API path templates owned by the `kanban` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.kanban`. */
export const kanbanRoutes = {
	board: "/admin/kanban/board",
	people: "/admin/kanban/people",
	items: "/admin/kanban/items",
	search: "/admin/kanban/search",
	createTask: "/admin/kanban/tasks",
	importTasks: "/admin/kanban/tasks/import",
	task: "/admin/kanban/tasks/:taskId",
	updateTask: "/admin/kanban/tasks/:taskId",
	deleteTask: "/admin/kanban/tasks/:taskId",
	moveTask: "/admin/kanban/tasks/:taskId/move",
	moveToParent: "/admin/kanban/tasks/:taskId/parent",
	moveColumn: "/admin/kanban/columns/:columnId/move",
	updateColumn: "/admin/kanban/columns/:columnId",
	comments: "/admin/kanban/tasks/:taskId/comments",
	addComment: "/admin/kanban/tasks/:taskId/comments",
	activity: "/admin/kanban/tasks/:taskId/activity",
	addLink: "/admin/kanban/tasks/:taskId/links",
	removeLink: "/admin/kanban/tasks/:taskId/links/:linkId",
	setChecklistItem: "/admin/kanban/tasks/:taskId/checklist/:itemId",
	watch: "/admin/kanban/tasks/:taskId/watch",
	unwatch: "/admin/kanban/tasks/:taskId/watch",
	attachFile: "/admin/kanban/tasks/:taskId/attachments",
	removeAttachment: "/admin/kanban/tasks/:taskId/attachments/:attachmentId",
	attachmentDownload: "/admin/kanban/tasks/:taskId/attachments/:attachmentId/download",
} satisfies Record<string, RouteTree>;
