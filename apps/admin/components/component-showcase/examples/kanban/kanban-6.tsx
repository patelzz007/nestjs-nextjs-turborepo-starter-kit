"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import { useCallback, useState, type ComponentProps } from "react";
import { Badge } from "@workspace/ui/components/badge";
import {
	Kanban,
	KanbanBoard,
	KanbanColumn,
	KanbanColumnContent,
	KanbanColumnHandle,
	KanbanItem,
	KanbanItemHandle,
	KanbanOverlay,
	type KanbanCommitMeta,
} from "@workspace/ui/components/kanban";
import { toastMessage } from "@workspace/ui/components/toast";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";

interface Task {
	id: string;
	title: string;
	priority: "low" | "medium" | "high";
}

const COLUMN_TITLES: Record<string, string> = {
	todo: "To Do",
	inProgress: "In Progress",
	done: "Done",
};

// Simulated backend. In a real app this would be a tRPC mutation or a fetch
// to your API. It rejects roughly one in four calls so the optimistic
// rollback path is easy to see.
/** The share of simulated saves that fail. */
const SAVE_FAILURE_RATE = 0.25;
const SAVE_LATENCY_MS = 700;

function persistBoard(): Promise<void> {
	return new Promise((resolve: () => void, reject: (reason: Error) => void): void => {
		setTimeout((): void => {
			if (Math.random() < SAVE_FAILURE_RATE) {
				reject(new Error("Network error"));
			} else {
				resolve();
			}
		}, SAVE_LATENCY_MS);
	});
}

interface TaskCardProps extends Omit<ComponentProps<typeof KanbanItem>, "value" | "children"> {
	task: Task;
	asHandle?: boolean | undefined;
	isOverlay?: boolean | undefined;
}

function TaskCard({ task, asHandle, isOverlay, ...props }: TaskCardProps): React.JSX.Element {
	const cardContent = (
		<Card>
			<CardContent className="flex items-center justify-between gap-2">
				<span className="line-clamp-1 text-sm font-medium">{task.title}</span>
				<Badge
					variant={task.priority === "high" ? "destructive-light" : task.priority === "medium" ? "primary-light" : "warning-light"}
					className="pointer-events-none h-5 shrink-0 rounded-sm px-1.5 text-xs capitalize">
					{task.priority}
				</Badge>
			</CardContent>
		</Card>
	);

	return (
		<KanbanItem value={task.id} {...props}>
			{asHandle && !isOverlay ? <KanbanItemHandle>{cardContent}</KanbanItemHandle> : cardContent}
		</KanbanItem>
	);
}

interface TaskColumnProps extends Omit<ComponentProps<typeof KanbanColumn>, "children"> {
	tasks: Task[];
	isOverlay?: boolean | undefined;
}

function TaskColumn({ value, tasks, isOverlay, ...props }: TaskColumnProps): React.JSX.Element {
	return (
		<KanbanColumn value={value} {...props}>
			<Card className="mb-2.5">
				<CardHeader className="flex items-center justify-between">
					<div className="flex items-center gap-2.5">
						<span className="text-sm font-semibold">{COLUMN_TITLES[value]}</span>
						<Badge variant="outline">{tasks.length}</Badge>
					</div>
					<KanbanColumnHandle render={COLUMN_HANDLE_BUTTON}>
						<GripVerticalIcon />
					</KanbanColumnHandle>
				</CardHeader>
				<CardContent>
					<KanbanColumnContent value={value} className="flex flex-col gap-2.5">
						{tasks.map((task) => (
							<TaskCard key={task.id} task={task} asHandle={!isOverlay} isOverlay={isOverlay} />
						))}
					</KanbanColumnContent>
				</CardContent>
			</Card>
		</KanbanColumn>
	);
}

/** Each card's stable id, which the board tracks it by. */
function itemId(item: Task): string {
	return item.id;
}

/** The column drag handle renders as a ghost icon button. */
const COLUMN_HANDLE_BUTTON: React.JSX.Element = <Button size="icon-xs" variant="ghost" aria-label="Drag column" />;

export function Kanban6Example(): React.JSX.Element {
	const [columns, setColumns] = useState<Record<string, Task[]>>({
		todo: [
			{ id: "1", title: "Add authentication", priority: "high" },
			{ id: "2", title: "Create API endpoints", priority: "medium" },
			{ id: "3", title: "Write documentation", priority: "low" },
		],
		inProgress: [
			{ id: "4", title: "Design system updates", priority: "high" },
			{ id: "5", title: "Implement dark mode", priority: "medium" },
		],
		done: [{ id: "6", title: "Setup project", priority: "low" }],
	});

	// Fires once per completed drag, never during the hover preview. The first
	// argument is the final board (already shown, because onValueChange applied
	// it live), so we only need meta.previousValue to roll back on failure.
	const handleValueCommit = useCallback((_next: Record<string, Task[]>, meta: KanbanCommitMeta<Task>): void => {
		const previous = meta.previousValue;
		const label =
			meta.kind === "column"
				? `Reordered "${COLUMN_TITLES[meta.activeContainer] ?? meta.activeContainer}"`
				: `Moved to "${COLUMN_TITLES[meta.overContainer] ?? meta.overContainer}"`;

		toastMessage
			.promise(persistBoard(), {
				loading: "Saving board...",
				success: (): string => label,
				error: (): string => {
					// Roll back to the pre-drag arrangement. In production prefer a
					// refetch here so a newer drag is not clobbered by this snapshot.
					setColumns(previous);
					return "Could not save. Board restored.";
				},
			})
			// The rejection is already reported by the error toast above.
			.catch((): void => undefined);
	}, []);

	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={itemId} onValueCommit={handleValueCommit}>
			<KanbanBoard className="grid auto-rows-fr grid-cols-3">
				{Object.entries(columns).map(([columnValue, tasks]) => (
					<TaskColumn key={columnValue} value={columnValue} tasks={tasks} />
				))}
			</KanbanBoard>
			<KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
		</Kanban>
	);
}
