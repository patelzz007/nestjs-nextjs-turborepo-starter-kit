import * as React from "react";

import { KanbanTaskDetailSkeleton } from "@/contexts/kanban/components/kanban-task-detail-view";

/** `/components/kanban-board/tasks/[id]` while the task is fetched — mirrors `KanbanTaskDetailView`. */
export default function KanbanTaskLoading(): React.JSX.Element {
	return <KanbanTaskDetailSkeleton />;
}
