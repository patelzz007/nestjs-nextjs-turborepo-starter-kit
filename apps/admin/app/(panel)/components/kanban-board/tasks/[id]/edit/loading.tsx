import * as React from "react";

import { KanbanTaskDetailSkeleton } from "@/contexts/kanban/components/kanban-task-detail-view";

/** `/components/kanban-board/tasks/[id]/edit` while the task is fetched. */
export default function EditKanbanTaskLoading(): React.JSX.Element {
	return <KanbanTaskDetailSkeleton />;
}
