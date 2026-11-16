import type { KanbanValue } from "@workspace/ui-kit-logic";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
import * as React from "react";
import { Text } from "react-native";

import { type Task, taskId } from "./kanban-sample";

const TITLES: Readonly<Record<string, string>> = { todo: "To Do", doing: "In Progress" };

// The whole card is the handle: every swipe that starts on a card drags it, so the board barely scrolls.
export function KanbanDont2Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<Task>>(() => ({
		todo: [{ id: "1", title: "Design landing page", priority: "medium" }],
		doing: [{ id: "2", title: "Implement auth flow", priority: "high" }],
	}));
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={taskId}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, tasks]: [string, Task[]]): React.JSX.Element => (
					<KanbanColumn key={column} value={column} label={TITLES[column] ?? column} className="w-56">
						<KanbanColumnContent>
							{tasks.map((task: Task): React.JSX.Element => (
								<KanbanItem key={task.id} value={task.id} label={task.title}>
									<KanbanItemHandle className="items-stretch">
										<Card size="sm">
											<CardContent>
												<Text className="text-label font-sans-medium text-foreground">{task.title}</Text>
											</CardContent>
										</Card>
									</KanbanItemHandle>
								</KanbanItem>
							))}
						</KanbanColumnContent>
					</KanbanColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}
