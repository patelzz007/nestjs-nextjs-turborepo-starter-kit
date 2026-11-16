"use client";

// The board the Do / Don't pairs show: two columns of tasks, each card dragged by its grip or as a whole, with or
// without the names screen readers and the move announcements read.

import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui/components/kanban";
import { GripVerticalIcon } from "lucide-react";
import * as React from "react";

interface Task {
	readonly id: string;
	readonly title: string;
}

const COLUMN_TITLES: Readonly<Record<string, string>> = { todo: "To do", doing: "In progress" };

const INITIAL: Record<string, Task[]> = {
	todo: [
		{ id: "notes", title: "Write release notes" },
		{ id: "invite", title: "Invite the beta group" },
	],
	doing: [{ id: "deploy", title: "Deploy to staging" }],
};

function taskId(task: Task): string {
	return task.id;
}

export interface GuidelineKanbanProps {
	/** Each column and card is named for screen readers. */
	readonly named: boolean;
	/** Cards move by a grip; otherwise the whole card is the handle. */
	readonly grip: boolean;
}

export function GuidelineKanban({ named, grip }: GuidelineKanbanProps): React.JSX.Element {
	const [columns, setColumns] = React.useState<Record<string, Task[]>>(INITIAL);
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={taskId}>
			<KanbanBoard className="grid w-full max-w-md grid-cols-2 gap-3">
				{Object.entries(columns).map(([column, tasks]: [string, Task[]]): React.JSX.Element => (
					<KanbanColumn key={column} value={column} aria-label={named ? COLUMN_TITLES[column] : undefined} className="flex flex-col gap-2 rounded-lg border p-2">
						<span className="text-sm font-semibold">{COLUMN_TITLES[column]}</span>
						<KanbanColumnContent value={column} className="flex flex-col gap-2">
							{tasks.map((task: Task): React.JSX.Element => (
								<KanbanItem key={task.id} value={task.id}>
									{grip ? (
										<div className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm">
											<KanbanItemHandle aria-label={named ? `Move ${task.title}` : undefined} className="text-muted-foreground">
												<GripVerticalIcon aria-hidden="true" className="size-4" />
											</KanbanItemHandle>
											{task.title}
										</div>
									) : (
										<KanbanItemHandle aria-label={named ? `Move ${task.title}` : undefined} className="block w-full rounded-md border bg-background p-2 text-start text-sm">
											{task.title}
										</KanbanItemHandle>
									)}
								</KanbanItem>
							))}
						</KanbanColumnContent>
					</KanbanColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}
