import * as React from "react";

import { EditKanbanTaskView } from "@/contexts/kanban/components/edit-kanban-task-view";
import { readKanbanTaskIdParam, type KanbanTaskRouteParams } from "@/contexts/kanban/lib/route-params";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

export const dynamic = "force-dynamic";

/** `/components/kanban-board/tasks/[id]/edit` — edit a task (READ + UPDATE KANBAN_TASK, enforced by the route guard and the API). */
export default async function EditKanbanTaskPage(props: KanbanTaskRouteParams): Promise<React.JSX.Element> {
	const taskId = await readKanbanTaskIdParam(props);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/components/kanban-board/tasks/[id]/edit", resource: "kanban task" }, () => server.kanban.task.query({ taskId }));

	return <EditKanbanTaskView taskId={taskId} initialTask={resolvePrefetchedData(result)} />;
}
