import { Kanban, KanbanBoard } from "@workspace/ui-native/components/kanban";
import type { KanbanValue } from "@workspace/ui-kit-logic";
import * as React from "react";

import { TASK_BOARD, TASK_COLUMN_TITLES, TaskCard, TaskColumn, taskId, type Task } from "./kanban-sample";

// Drag a card by its grip: the card it is over (or the column's empty space) is outlined where it will land.
export function Kanban1Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<Task>>(() =>
		Object.fromEntries(Object.entries(TASK_BOARD).map(([key, tasks]): [string, Task[]] => [key, [...tasks]])),
	);
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={taskId}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, tasks]: [string, Task[]]): React.JSX.Element => (
					<TaskColumn key={column} column={column} title={TASK_COLUMN_TITLES[column] ?? column} count={tasks.length}>
						{tasks.map((task: Task): React.JSX.Element => (
							<TaskCard key={task.id} task={task} />
						))}
					</TaskColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}
