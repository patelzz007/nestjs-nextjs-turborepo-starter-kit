import type { KanbanTask } from "@workspace/shared";
import { Progress } from "@workspace/ui/components/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import Link from "next/link";
import * as React from "react";

import { effectiveSchedule, formatDateRange, pointsLabel } from "../lib/kanban-display";
import type { KanbanColumnHeading } from "./kanban-board-columns";
import { KanbanPriorityBadge, KanbanTeamBadge, KanbanTypeBadge } from "./kanban-task-badges";
import { KanbanAssignee } from "./kanban-person";

/** A story's estimate, or an epic's / feature's done points of its total; a task carries none. */
function pointsText(task: KanbanTask): string {
	if (task.type === "STORY") {
		return task.storyPoints === null ? "—" : pointsLabel(task.storyPoints);
	}
	return task.type === "TASK" ? "—" : `${String(task.rollup.points.done)}/${pointsLabel(task.rollup.points.total)}`;
}

export interface KanbanTaskTableProps {
	readonly columns: readonly KanbanColumnHeading[];
	readonly tasksByColumn: Readonly<Record<string, readonly KanbanTask[]>>;
	readonly taskHref: (taskId: string) => string;
}

/** The table view: every item in one table, column by column. */
export function KanbanTaskTable({ columns, tasksByColumn, taskHref }: KanbanTaskTableProps): React.JSX.Element {
	const rows = columns.flatMap((column) => (tasksByColumn[column.id] ?? []).map((task) => ({ task, column })));
	return (
		<div className="p-4 lg:p-5">
			<div className="overflow-x-auto rounded-xl border bg-card">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Item</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Parent</TableHead>
							<TableHead>Column</TableHead>
							<TableHead>Priority</TableHead>
							<TableHead>Team</TableHead>
							<TableHead>Assignee</TableHead>
							<TableHead>Points</TableHead>
							<TableHead>Dates</TableHead>
							<TableHead className="w-40">Progress</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
									No items match.
								</TableCell>
							</TableRow>
						) : (
							rows.map(({ task, column }) => (
								<TableRow key={task.id}>
									<TableCell className="max-w-72">
										<Link href={taskHref(task.id)} className="block truncate font-medium hover:underline">
											{task.title}
										</Link>
									</TableCell>
									<TableCell>
										<KanbanTypeBadge type={task.type} />
									</TableCell>
									<TableCell className="max-w-48 truncate text-muted-foreground">{task.ancestors.at(task.ancestors.length - 1)?.title ?? "—"}</TableCell>
									<TableCell className="text-muted-foreground">{column.title}</TableCell>
									<TableCell>
										<KanbanPriorityBadge priority={task.priority} />
									</TableCell>
									<TableCell>
										<KanbanTeamBadge team={task.team} />
									</TableCell>
									<TableCell>
										<KanbanAssignee person={task.assignee} />
									</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{pointsText(task)}</TableCell>
									<TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
										{formatDateRange(effectiveSchedule(task).startAt, effectiveSchedule(task).dueAt)}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Progress value={task.progress} className="flex-1" aria-label={`${task.title} progress`} />
											<span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{task.progress}%</span>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
