import { Skeleton } from "@workspace/ui/components/skeleton";
import * as React from "react";

/** The board's columns while `/components/kanban-board` loads — the shape `KanbanBoardView` draws. */
const LOADING_COLUMN_COUNT = 5;

export default function KanbanLoading(): React.JSX.Element {
	return (
		<div className="flex h-[calc(100dvh-8.5rem)] min-h-[40rem] flex-col overflow-hidden rounded-xl border bg-card" aria-busy aria-label="Loading the board">
			<div className="flex items-center justify-between gap-3 border-b px-4 py-3 lg:px-6">
				<Skeleton className="h-9 w-64" />
				<Skeleton className="h-9 w-96" />
			</div>
			<div className="grid flex-1 auto-cols-[minmax(20rem,1fr)] grid-flow-col gap-4 overflow-hidden p-4 lg:p-5">
				{Array.from({ length: LOADING_COLUMN_COUNT }, (_, index) => (
					<div key={`loading-column-${String(index)}`} className="flex flex-col gap-3 rounded-t-xl border bg-muted/50 p-4">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-3 w-12" />
						<Skeleton className="h-32 w-full rounded-xl" />
						<Skeleton className="h-32 w-full rounded-xl" />
					</div>
				))}
			</div>
		</div>
	);
}
