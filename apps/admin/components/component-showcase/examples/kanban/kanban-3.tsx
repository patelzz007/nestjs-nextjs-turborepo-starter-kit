"use client";

import * as React from "react";
import { CircleCheckIcon, CircleDot, CircleIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@workspace/ui/components/kanban";

interface Task {
	id: string;
	title: string;
	label: string;
	labelVariant: "primary-light" | "success-light" | "warning-light" | "destructive-light" | "info-light";
}

const COLUMNS: Record<string, { title: string; icon: React.ReactNode }> = {
	todo: {
		title: "To Do",
		icon: <CircleIcon className="size-4" />,
	},
	doing: {
		title: "In Progress",
		icon: <CircleDot className="size-4 text-muted-foreground" />,
	},
	done: {
		title: "Done",
		icon: <CircleCheckIcon className="size-4" />,
	},
};

function TaskCard({ task, asHandle, ...props }: { task: Task; asHandle?: boolean } & Omit<ComponentProps<typeof KanbanItem>, "value" | "children">): React.JSX.Element {
	const content = (
		<Frame variant="ghost" spacing="sm" className="p-0">
			<FramePanel className="p-3">
				<div className="flex flex-col gap-2">
					<span className="text-sm font-medium">{task.title}</span>
					<Badge variant={task.labelVariant} size="sm" className="w-fit">
						{task.label}
					</Badge>
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

export function Kanban3Example(): React.JSX.Element {
	const [columns, setColumns] = useState<Record<string, Task[]>>({
		todo: [
			{
				id: "1",
				title: "Design landing page",
				label: "Design",
				labelVariant: "info-light",
			},
			{
				id: "2",
				title: "Set up CI/CD pipeline",
				label: "DevOps",
				labelVariant: "warning-light",
			},
			{
				id: "3",
				title: "Write unit tests",
				label: "Testing",
				labelVariant: "success-light",
			},
		],
		doing: [
			{
				id: "4",
				title: "Implement auth flow",
				label: "Backend",
				labelVariant: "primary-light",
			},
			{
				id: "5",
				title: "Create component library",
				label: "Frontend",
				labelVariant: "destructive-light",
			},
		],
		done: [
			{
				id: "6",
				title: "Project kickoff",
				label: "Planning",
				labelVariant: "info-light",
			},
		],
	});

	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={itemId}>
			<KanbanBoard className="grid auto-rows-fr grid-cols-3">
				{Object.entries(columns).map(([columnId, tasks]) => {
					const col = COLUMNS[columnId] ?? { title: columnId, icon: null };
					return (
						<KanbanColumn key={columnId} value={columnId}>
							<Frame spacing="sm" className="h-full">
								<FrameHeader className="flex flex-row items-center gap-2">
									{col.icon}
									<FrameTitle>{col.title}</FrameTitle>
									<Badge variant="outline" size="sm" className="ml-auto">
										{tasks.length}
									</Badge>
								</FrameHeader>
								<KanbanColumnContent value={columnId} className="flex flex-col gap-2 p-0.5">
									{tasks.map((task) => (
										<TaskCard key={task.id} task={task} asHandle />
									))}
								</KanbanColumnContent>
							</Frame>
						</KanbanColumn>
					);
				})}
			</KanbanBoard>
			<KanbanOverlay className="rounded-md border-2 border-dashed bg-muted/10" />
		</Kanban>
	);
}
