import * as React from "react";

import { KanbanTaskDetailView } from "@/contexts/kanban/components/kanban-task-detail-view";
import { readKanbanTaskIdParam, type KanbanTaskRouteParams } from "@/contexts/kanban/lib/route-params";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

export const dynamic = "force-dynamic";

/** `/components/kanban-board/tasks/[id]` — one task (READ + LIST KANBAN_TASK). A malformed id or a missing task renders the 404 page. */
export default async function KanbanTaskPage(props: KanbanTaskRouteParams): Promise<React.JSX.Element> {
	const taskId = await readKanbanTaskIdParam(props);
	const server = createAdminServerCaller();
	const result = await prefetch({ page: "/components/kanban-board/tasks/[id]", resource: "kanban task" }, () => server.kanban.task.query({ taskId }));

	return <KanbanTaskDetailView taskId={taskId} initialTask={resolvePrefetchedData(result)} />;
}
