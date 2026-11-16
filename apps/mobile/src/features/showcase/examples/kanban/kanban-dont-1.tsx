import type { KanbanValue } from "@workspace/ui-kit-logic";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
import * as React from "react";
import { Text, View } from "react-native";

import { GRIP } from "./kanban-sample";

function idOf(id: string): string {
	return id;
}

// No labels: a handle is read as "Move t1", and a move as "t1 moved to c2" — ids, not names.
export function KanbanDont1Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<string>>(() => ({ c1: ["t1"], c2: ["t2"] }));
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={idOf}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, ids]: [string, string[]]): React.JSX.Element => (
					<KanbanColumn key={column} value={column} className="w-40">
						<KanbanColumnContent>
							{ids.map((id: string): React.JSX.Element => (
								<KanbanItem key={id} value={id}>
									<View className="flex-row items-center gap-1 rounded-md bg-card p-1">
										<KanbanItemHandle className="min-h-8 min-w-8">{GRIP}</KanbanItemHandle>
										<Text className="text-label font-sans text-foreground">Task</Text>
									</View>
								</KanbanItem>
							))}
						</KanbanColumnContent>
					</KanbanColumn>
				))}
			</KanbanBoard>
		</Kanban>
	);
}
