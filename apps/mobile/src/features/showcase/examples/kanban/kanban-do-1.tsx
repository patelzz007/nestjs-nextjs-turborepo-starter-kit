import type { KanbanValue } from "@workspace/ui-kit-logic";
import { Kanban, KanbanBoard } from "@workspace/ui-native/components/kanban";
import * as React from "react";

import { type Task, TaskCard, TaskColumn, taskId } from "./kanban-sample";

const TITLES: Readonly<Record<string, string>> = { todo: "To Do", done: "Done" };

// Named columns and cards: a handle is read as "Move Write tests", and a move as "Write tests moved to Done".
export function KanbanDo1Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<Task>>(() => ({
		todo: [{ id: "1", title: "Write tests", priority: "high" }],
		done: [{ id: "2", title: "Setup project", priority: "low" }],
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
