// What the Kanban examples share: a task board's sample cards, a task card with its grip, and a column with its header.

import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge, type BadgeTone } from "@workspace/ui-native/components/badge";
import { Card, CardContent } from "@workspace/ui-native/components/card";
import { Icon } from "@workspace/ui-native/components/icon";
import { KanbanColumn, KanbanColumnContent, KanbanColumnHandle, KanbanItem, KanbanItemHandle } from "@workspace/ui-native/components/kanban";
import GripVerticalIcon from "lucide-react-native/icons/grip-vertical";
import * as React from "react";
import { Text, View } from "react-native";

export type Priority = "low" | "medium" | "high";

export interface Task {
	readonly id: string;
	readonly title: string;
	readonly priority: Priority;
	readonly assignee?: string | undefined;
	readonly avatar?: string | undefined;
	readonly dueDate?: string | undefined;
}

export const PRIORITY_TONES: Readonly<Record<Priority, BadgeTone>> = { high: "destructive", medium: "primary", low: "warning" };

/** The web examples' portraits (images.unsplash.com). */
const PORTRAIT = "?w=96&h=96&dpr=2&q=80";

export const TASK_BOARD: Readonly<Record<string, readonly Task[]>> = {
	backlog: [
		{
			id: "1",
			title: "Add authentication",
			priority: "high",
			assignee: "Alex Johnson",
			avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde${PORTRAIT}`,
			dueDate: "Jan 10, 2025",
		},
		{
			id: "2",
			title: "Create API endpoints",
			priority: "medium",
			assignee: "Sarah Chen",
			avatar: `https://images.unsplash.com/photo-1519699047748-de8e457a634e${PORTRAIT}`,
			dueDate: "Jan 15, 2025",
		},
		{
			id: "3",
			title: "Write documentation",
			priority: "low",
			assignee: "Michael Rodriguez",
			avatar: `https://images.unsplash.com/photo-1584308972272-9e4e7685e80f${PORTRAIT}`,
			dueDate: "Jan 20, 2025",
		},
	],
	inProgress: [
		{
			id: "4",
			title: "Design system updates",
			priority: "high",
			assignee: "Emma Wilson",
			avatar: `https://images.unsplash.com/photo-1485893086445-ed75865251e0${PORTRAIT}`,
			dueDate: "Aug 25, 2025",
		},
		{
			id: "5",
			title: "Implement dark mode",
			priority: "medium",
			assignee: "David Kim",
			avatar: `https://images.unsplash.com/photo-1607990281513-2c110a25bd8c${PORTRAIT}`,
			dueDate: "Aug 25, 2025",
		},
	],
	done: [
		{
			id: "7",
			title: "Setup project",
			priority: "high",
			assignee: "Aron Thompson",
			avatar: `https://images.unsplash.com/photo-1527980965255-d3b416303d12${PORTRAIT}`,
			dueDate: "Sep 25, 2025",
		},
		{
			id: "8",
			title: "Initial commit",
			priority: "low",
			assignee: "James Brown",
			avatar: `https://images.unsplash.com/photo-1543299750-19d1d6297053${PORTRAIT}`,
			dueDate: "Sep 20, 2025",
		},
	],
};

export const TASK_COLUMN_TITLES: Readonly<Record<string, string>> = { backlog: "Backlog", inProgress: "In Progress", done: "Done" };

export function taskId(task: Task): string {
	return task.id;
}

export const GRIP = <Icon icon={GripVerticalIcon} size="sm" colorClassName="accent-muted-foreground" />;

/** A task: its title and priority, its assignee and due date, dragged by its grip. */
export function TaskCard({ task }: { readonly task: Task }): React.JSX.Element {
	return (
		<KanbanItem value={task.id} label={task.title}>
			<Card size="sm">
				<CardContent className="gap-2.5">
					<View className="flex-row items-center gap-2">
						<KanbanItemHandle className="min-h-8 min-w-8">{GRIP}</KanbanItemHandle>
						<Text numberOfLines={1} className="text-label font-sans-medium flex-1 text-foreground">
							{task.title}
						</Text>
						<Badge label={task.priority} tone={PRIORITY_TONES[task.priority]} variant="light" size="sm" shape="rounded" />
					</View>
					{task.assignee === undefined ? null : (
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center gap-1">
								<Avatar name={task.assignee} imageUrl={task.avatar ?? null} size="sm" />
								<Text numberOfLines={1} className="text-caption font-sans text-muted-foreground">
									{task.assignee}
								</Text>
							</View>
							{task.dueDate === undefined ? null : <Text className="text-overline font-sans text-muted-foreground tabular-nums">{task.dueDate}</Text>}
						</View>
					)}
				</CardContent>
			</Card>
		</KanbanItem>
	);
}

/** A column: its title and count, a grip to move it, and its cards. */
export function TaskColumn({
	column,
	title,
	count,
	children,
}: {
	readonly column: string;
	readonly title: string;
	readonly count: number;
	readonly children: React.ReactNode;
}): React.JSX.Element {
	return (
		<KanbanColumn value={column} label={title} className="w-64">
			<View className="flex-row items-center justify-between px-1 pb-2">
				<View className="flex-row items-center gap-2.5">
					<Text className="text-label font-sans-semibold text-foreground">{title}</Text>
					<Badge label={String(count)} variant="outline" size="sm" />
				</View>
				<KanbanColumnHandle>{GRIP}</KanbanColumnHandle>
			</View>
			<KanbanColumnContent>{children}</KanbanColumnContent>
		</KanbanColumn>
	);
}
