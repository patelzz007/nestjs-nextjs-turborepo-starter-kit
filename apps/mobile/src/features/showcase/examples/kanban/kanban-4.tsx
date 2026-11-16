import type { KanbanValue } from "@workspace/ui-kit-logic";
import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
import { Progress } from "@workspace/ui-native/components/progress";
import * as React from "react";
import { Text, View } from "react-native";

import { GRIP } from "./kanban-sample";

interface ProgressTask {
	readonly id: string;
	readonly title: string;
	readonly assignee: string;
	readonly avatar: string;
	/** Percent done, 0 to 100. */
	readonly progress: number;
}

const COLUMNS: Readonly<Record<string, { readonly title: string; readonly description: string }>> = {
	planning: { title: "Planning", description: "Tasks being scoped" },
	active: { title: "Active", description: "Currently in development" },
	completed: { title: "Completed", description: "Finished and deployed" },
};

/** The web examples' portraits (images.unsplash.com). */
const PORTRAIT = "?w=96&h=96&dpr=2&q=80";

const BOARD: Readonly<Record<string, readonly ProgressTask[]>> = {
	planning: [{ id: "1", title: "Research competitors", assignee: "Alex J.", avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde${PORTRAIT}`, progress: 20 }],
	active: [
		{ id: "2", title: "Build dashboard", assignee: "Sarah C.", avatar: `https://images.unsplash.com/photo-1519699047748-de8e457a634e${PORTRAIT}`, progress: 65 },
		{ id: "3", title: "API integration", assignee: "David K.", avatar: `https://images.unsplash.com/photo-1607990281513-2c110a25bd8c${PORTRAIT}`, progress: 40 },
	],
	completed: [{ id: "4", title: "Setup repository", assignee: "Emma W.", avatar: `https://images.unsplash.com/photo-1485893086445-ed75865251e0${PORTRAIT}`, progress: 100 }],
};

function idOf(task: ProgressTask): string {
	return task.id;
}

/** A task: its title, how far along it is, and who has it. */
function ProgressCard({ task }: { readonly task: ProgressTask }): React.JSX.Element {
	const percent = `${String(task.progress)}%`;
	return (
		<KanbanItem value={task.id} label={task.title}>
			<Frame variant="ghost" spacing="xs" className="p-0">
				<FramePanel className="gap-3 p-3">
					<View className="flex-row items-center gap-1">
						<KanbanItemHandle className="min-h-8 min-w-8">{GRIP}</KanbanItemHandle>
						<Text numberOfLines={1} className="text-label font-sans-medium flex-1 text-foreground">
							{task.title}
						</Text>
					</View>
					<Progress value={task.progress} size="sm" accessibilityLabel={`${task.title} progress`} />
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-1.5">
							<Avatar name={task.assignee} imageUrl={task.avatar} size="sm" />
							<Text className="text-caption font-sans text-muted-foreground">{task.assignee}</Text>
						</View>
						<Text className="text-caption font-sans text-muted-foreground tabular-nums">{percent}</Text>
					</View>
				</FramePanel>
			</Frame>
		</KanbanItem>
	);
}

// Columns as stacked frames: a title, a count and a line on what the column holds.
export function Kanban4Example(): React.JSX.Element {
	const [columns, setColumns] = React.useState<KanbanValue<ProgressTask>>(() =>
		Object.fromEntries(Object.entries(BOARD).map(([key, tasks]): [string, ProgressTask[]] => [key, [...tasks]])),
	);
	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={idOf}>
			<KanbanBoard>
				{Object.entries(columns).map(([column, tasks]: [string, ProgressTask[]]): React.JSX.Element => {
					const meta = COLUMNS[column] ?? { title: column, description: "" };
					return (
						<KanbanColumn key={column} value={column} label={meta.title} className="w-60 border-0 bg-transparent p-0">
							<Frame stacked spacing="sm">
								<FrameHeader className="gap-1">
									<View className="flex-row items-center justify-between">
										<FrameTitle>{meta.title}</FrameTitle>
										<Badge label={String(tasks.length)} variant="outline" size="sm" />
									</View>
									<FrameDescription>{meta.description}</FrameDescription>
								</FrameHeader>
								<KanbanColumnContent className="p-0.5">
									{tasks.map((task: ProgressTask): React.JSX.Element => (
										<ProgressCard key={task.id} task={task} />
									))}
								</KanbanColumnContent>
							</Frame>
						</KanbanColumn>
					);
				})}
			</KanbanBoard>
		</Kanban>
	);
}
