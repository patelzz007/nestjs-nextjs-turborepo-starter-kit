import { findKanbanItem, type KanbanValue } from "@workspace/ui-kit-logic";
import { Kanban, KanbanBoard, type KanbanMove } from "@workspace/ui-native/components/kanban";
import * as React from "react";

import { useToast } from "../../../toast/facade";
import { type Task, TaskCard, TaskColumn, taskId } from "./kanban-sample";

const COLUMN_TITLES: Readonly<Record<string, string>> = { todo: "To Do", inProgress: "In Progress", done: "Done" };

const BOARD: Readonly<Record<string, readonly Task[]>> = {
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
};

// Simulated backend. In a real app this is a call to your API. It rejects
// roughly one in four saves so the rollback is easy to see.
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

function titleOf(column: string): string {
	return COLUMN_TITLES[column] ?? column;
}

/** What the success toast says about a move. */
export function moveSummaryOf(board: KanbanValue<Task>, move: KanbanMove): string {
	if (move.kind === "column") {
		return `Reordered "${titleOf(move.id)}"`;
	}
	const column = findKanbanItem(board, taskId, move.id)?.container ?? move.overId;
	return `Moved to "${titleOf(column)}"`;
}

// Saves each finished move, optimistically: the board changes at once, a
// toast follows the save, and a failed save puts the board back.
export function Kanban6Example(): React.JSX.Element {
	const toast = useToast();
	const [columns, setColumns] = React.useState<KanbanValue<Task>>(() => Object.fromEntries(Object.entries(BOARD).map(([key, tasks]): [string, Task[]] => [key, [...tasks]])));
	// `columns` here is still the board before the move: the snapshot to roll back to.
	const handleValueCommit = React.useCallback(
		(next: KanbanValue<Task>, move: KanbanMove): void => {
			const previous = columns;
			const summary = moveSummaryOf(next, move);
			toast
				.promise(persistBoard(), { loading: "Saving board...", success: (): string => summary, error: "Could not save. Board restored." })
				// The error toast has already said so. In production prefer a refetch,
				// so a newer move is not clobbered by this snapshot.
				.catch((): void => {
					setColumns(previous);
				});
		},
		[columns, toast],
	);
	return (
		<Kanban value={columns} onValueChange={setColumns} onValueCommit={handleValueCommit} getItemValue={taskId}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, tasks]: [string, Task[]]): React.JSX.Element => (
					<TaskColumn key={column} column={column} title={titleOf(column)} count={tasks.length}>
						{tasks.map((task: Task): React.JSX.Element => (
							<TaskCard key={task.id} task={task} />
						))}
					</TaskColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}
