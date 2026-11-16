import type { KanbanValue } from "@workspace/ui-kit-logic";
import { Kanban, KanbanBoard } from "@workspace/ui-native/components/kanban";
import * as React from "react";

import { type Task, TaskCard, TaskColumn, taskId } from "./kanban-sample";

const TITLES: Readonly<Record<string, string>> = { todo: "To Do", doing: "In Progress" };

// A grip on each card: a swipe across the cards scrolls the board, a drag on the grip moves the card.
export function KanbanDo2Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<Task>>(() => ({
		todo: [{ id: "1", title: "Design landing page", priority: "medium" }],
		doing: [{ id: "2", title: "Implement auth flow", priority: "high" }],
	}));
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={taskId}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, tasks]: [string, Task[]]): React.JSX.Element => (
					<TaskColumn key={column} column={column} title={TITLES[column] ?? column} count={tasks.length}>
						{tasks.map((task: Task): React.JSX.Element => (
							<TaskCard key={task.id} task={task} />
						))}
					</TaskColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}
