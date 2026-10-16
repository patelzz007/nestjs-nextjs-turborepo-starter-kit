"use client";

import * as React from "react";
import { useState, type ComponentProps } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Frame, FrameDescription, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@workspace/ui/components/kanban";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Progress } from "@workspace/ui/components/progress";

interface Task {
	id: string;
	title: string;
	assignee: string;
	assigneeAvatar: string;
	progress: number;
}

function TaskCard({ task, asHandle, ...props }: { task: Task; asHandle?: boolean } & Omit<ComponentProps<typeof KanbanItem>, "value" | "children">): React.JSX.Element {
	const content = (
		<Frame variant="ghost" spacing="xs" className="p-0">
			<FramePanel className="space-y-3 p-3">
				<p className="text-sm font-medium">{task.title}</p>
				<Progress value={task.progress} className="[&_[data-slot=progress-track]]:h-1" />
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5">
						<Avatar className="size-5">
							<AvatarImage src={task.assigneeAvatar} alt={task.assignee} />
							<AvatarFallback className="text-[9px]">{task.assignee.charAt(0)}</AvatarFallback>
						</Avatar>
						<span className="text-xs text-muted-foreground">{task.assignee}</span>
					</div>
					<span className="text-xs text-muted-foreground">{task.progress}%</span>
				</div>
			</FramePanel>
		</Frame>
	);

	return (
		<KanbanItem value={task.id} {...props}>
			{asHandle ? <KanbanItemHandle>{content}</KanbanItemHandle> : content}
		</KanbanItem>
	);
}

/** Each card's stable id, which the board tracks it by. */
function itemId(item: Task): string {
	return item.id;
}

export function Kanban4Example(): React.JSX.Element {
	const [columns, setColumns] = useState<Record<string, Task[]>>({
		planning: [
			{
				id: "1",
				title: "Research competitors",
				assignee: "Alex J.",
				assigneeAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
				progress: 20,
			},
		],
		active: [
			{
				id: "2",
				title: "Build dashboard",
				assignee: "Sarah C.",
				assigneeAvatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
				progress: 65,
			},
			{
				id: "3",
				title: "API integration",
				assignee: "David K.",
				assigneeAvatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
				progress: 40,
			},
		],
		completed: [
			{
				id: "4",
				title: "Setup repository",
				assignee: "Emma W.",
				assigneeAvatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
				progress: 100,
			},
		],
	});

	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={itemId}>
			<KanbanBoard className="grid auto-rows-fr grid-cols-3">
				{Object.entries(columns).map(([columnId, tasks]) => (
					<KanbanColumn key={columnId} value={columnId}>
						<Frame stacked spacing="sm" className="h-full">
							<FrameHeader>
								<div className="flex items-center justify-between">
									<FrameTitle className="capitalize">{columnId}</FrameTitle>
									<Badge variant="outline" size="sm">
										{tasks.length}
									</Badge>
								</div>
								<FrameDescription>
									{columnId === "planning" ? "Tasks being scoped" : null}
									{columnId === "active" ? "Currently in development" : null}
									{columnId === "completed" ? "Finished and deployed" : null}
								</FrameDescription>
							</FrameHeader>
							<KanbanColumnContent value={columnId} className="flex flex-col gap-2 p-0.5">
								{tasks.map((task) => (
									<TaskCard key={task.id} task={task} asHandle />
								))}
							</KanbanColumnContent>
						</Frame>
					</KanbanColumn>
				))}
			</KanbanBoard>
			<KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
		</Kanban>
	);
}
