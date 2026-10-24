import type { KanbanTask } from "@workspace/shared";
import Link from "next/link";
import * as React from "react";

import { effectiveSchedule, formatDateRange, itemCountLabel } from "../lib/kanban-display";
import type { KanbanColumnHeading } from "./kanban-board-columns";
import { KanbanPointsBadge, KanbanPriorityBadge, KanbanTeamBadge, KanbanTypeBadge } from "./kanban-task-badges";
import { KanbanAssignee } from "./kanban-person";

export interface KanbanTaskListProps {
	readonly columns: readonly KanbanColumnHeading[];
	/** Column id → its tasks as arranged (filtered and sorted). */
	readonly tasksByColumn: Readonly<Record<string, readonly KanbanTask[]>>;
	readonly taskHref: (taskId: string) => string;
}

/** The list view: one section per column, one compact row per item. */
export function KanbanTaskList({ columns, tasksByColumn, taskHref }: KanbanTaskListProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-6 p-4 lg:p-5">
			{columns.map((column) => {
				const tasks = tasksByColumn[column.id] ?? [];
				return (
					<section key={column.id} aria-label={column.title} className="flex flex-col gap-2">
						<div className="flex items-baseline gap-2">
							<h2 className="text-base font-medium">{column.title}</h2>
							<span className="text-sm text-muted-foreground tabular-nums">{itemCountLabel(tasks.length)}</span>
						</div>
						{tasks.length === 0 ? (
							<p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">No items here.</p>
						) : (
							<ul className="divide-y rounded-xl border bg-card">
								{tasks.map((task) => (
									<li key={task.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="flex min-w-0 items-center gap-3">
											<KanbanTypeBadge type={task.type} />
											<KanbanPriorityBadge priority={task.priority} />
											<Link href={taskHref(task.id)} className="truncate text-sm font-medium hover:underline">
												{task.title}
											</Link>
										</div>
										<div className="flex shrink-0 flex-wrap items-center gap-3 text-sm text-muted-foreground">
											<KanbanTeamBadge team={task.team} />
											{task.type === "STORY" && task.storyPoints !== null ? <KanbanPointsBadge points={task.storyPoints} /> : null}
											<KanbanAssignee person={task.assignee} />
											<span className="tabular-nums">{formatDateRange(effectiveSchedule(task).startAt, effectiveSchedule(task).dueAt)}</span>
										</div>
									</li>
								))}
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}
