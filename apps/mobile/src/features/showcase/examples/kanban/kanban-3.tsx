import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Frame, FramePanel } from "@workspace/ui-native/components/frame";
import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
import type { KanbanValue } from "@workspace/ui-kit-logic";
import CircleIcon from "lucide-react-native/icons/circle";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CircleDotIcon from "lucide-react-native/icons/circle-dot";
import * as React from "react";
import { Text, View } from "react-native";

import { GRIP } from "./kanban-sample";

interface LabelledTask {
	readonly id: string;
	readonly title: string;
	readonly label: string;
	readonly tone: BadgeTone;
}

const COLUMNS: Readonly<Record<string, { readonly title: string; readonly icon: LucideIcon }>> = {
	todo: { title: "To Do", icon: CircleIcon },
	doing: { title: "In Progress", icon: CircleDotIcon },
	done: { title: "Done", icon: CircleCheckIcon },
};

const BOARD: Readonly<Record<string, readonly LabelledTask[]>> = {
	todo: [
		{ id: "1", title: "Design landing page", label: "Design", tone: "info" },
		{ id: "2", title: "Set up CI/CD pipeline", label: "DevOps", tone: "warning" },
		{ id: "3", title: "Write unit tests", label: "Testing", tone: "success" },
	],
	doing: [
		{ id: "4", title: "Implement auth flow", label: "Backend", tone: "primary" },
		{ id: "5", title: "Create component library", label: "Frontend", tone: "info" },
	],
	done: [{ id: "6", title: "Project kickoff", label: "Planning", tone: "success" }],
};

function idOf(task: LabelledTask): string {
	return task.id;
}

// Frame columns: a status glyph and a count over label cards.
export function Kanban3Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<LabelledTask>>(() =>
		Object.fromEntries(Object.entries(BOARD).map(([key, tasks]): [string, LabelledTask[]] => [key, [...tasks]])),
	);
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={idOf}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, tasks]: [string, LabelledTask[]]): React.JSX.Element => {
					const meta = COLUMNS[column] ?? { title: column, icon: CircleIcon };
					return (
						<KanbanColumn key={column} value={column} label={meta.title} className="w-60">
							<View className="flex-row items-center gap-2 px-1 pb-2">
								<Icon icon={meta.icon} size="sm" colorClassName="accent-muted-foreground" />
								<Text className="text-label font-sans-semibold text-foreground">{meta.title}</Text>
								<Text className="text-caption font-sans text-muted-foreground tabular-nums">{String(tasks.length)}</Text>
							</View>
							<KanbanColumnContent>
								{tasks.map((task: LabelledTask): React.JSX.Element => (
									<KanbanItem key={task.id} value={task.id} label={task.title}>
										<Frame variant="ghost" spacing="sm" className="p-0">
											<FramePanel className="flex-row items-start gap-1 p-2">
												<KanbanItemHandle className="min-h-8 min-w-8">{GRIP}</KanbanItemHandle>
												<View className="flex-1 gap-2">
													<Text className="text-label font-sans-medium text-foreground">{task.title}</Text>
													<Badge label={task.label} tone={task.tone} variant="light" size="sm" />
												</View>
											</FramePanel>
										</Frame>
									</KanbanItem>
								))}
							</KanbanColumnContent>
						</KanbanColumn>
					);
				})}
			</KanbanBoard>
		</Kanban>
	);
}
