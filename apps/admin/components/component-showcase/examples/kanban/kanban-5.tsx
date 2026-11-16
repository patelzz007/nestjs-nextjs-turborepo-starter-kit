"use client";

import * as React from "react";
import { ArrowUpIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Badge } from "@workspace/ui/components/badge";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui/components/frame";
import { Kanban, KanbanBoard, KanbanColumn, KanbanColumnContent, KanbanItem, KanbanItemHandle, KanbanOverlay } from "@workspace/ui/components/kanban";

import { cn } from "@workspace/ui/lib/core/utils";
import { Progress } from "@workspace/ui/components/progress";

interface Feature {
	id: string;
	title: string;
	description: string;
	progress: number;
	votes: number;
}

const COLUMNS: Record<string, { title: string; color: string }> = {
	planned: { title: "Planned", color: "bg-tone-blue" },
	building: { title: "Building", color: "bg-tone-yellow" },
	shipped: { title: "Shipped", color: "bg-tone-green" },
};

function FeatureCard({
	feature,
	asHandle,
	...props
}: { feature: Feature; asHandle?: boolean } & Omit<ComponentProps<typeof KanbanItem>, "value" | "children">): React.JSX.Element {
	const content = (
		<Frame variant="ghost" spacing="sm" className="p-0">
			<FramePanel className="p-3">
				<div className="flex flex-col gap-2.5">
					<span className="text-sm font-medium">{feature.title}</span>
					<p className="line-clamp-2 text-xs text-muted-foreground">{feature.description}</p>
					<Progress value={feature.progress} className="h-1.5" />
					<div className="flex items-center justify-between">
						<span className="text-[10px] text-muted-foreground tabular-nums">{feature.progress}% complete</span>
						<div className="flex items-center gap-1">
							<ArrowUpIcon className="size-3 text-muted-foreground" />
							<span className="text-xs text-muted-foreground tabular-nums">{feature.votes}</span>
						</div>
					</div>
				</div>
			</FramePanel>
		</Frame>
	);

	return (
		<KanbanItem value={feature.id} {...props}>
			{asHandle ? <KanbanItemHandle>{content}</KanbanItemHandle> : content}
		</KanbanItem>
	);
}

/** Each card's stable id, which the board tracks it by. */
function itemId(item: Feature): string {
	return item.id;
}

export function Kanban5Example(): React.JSX.Element {
	const [columns, setColumns] = useState<Record<string, Feature[]>>({
		planned: [
			{
				id: "f1",
				title: "AI-powered search",
				description: "Natural language search across all content",
				progress: 0,
				votes: 142,
			},
			{
				id: "f2",
				title: "Custom webhooks",
				description: "User-configurable webhook endpoints",
				progress: 0,
				votes: 98,
			},
		],
		building: [
			{
				id: "f3",
				title: "Real-time collaboration",
				description: "Multi-user editing with presence indicators",
				progress: 65,
				votes: 234,
			},
			{
				id: "f4",
				title: "API v2 migration",
				description: "RESTful API with OpenAPI 3.0 spec",
				progress: 40,
				votes: 176,
			},
		],
		shipped: [
			{
				id: "f6",
				title: "Dark mode",
				description: "System-aware theme with manual override",
				progress: 100,
				votes: 456,
			},
			{
				id: "f7",
				title: "Export to CSV",
				description: "Bulk data export with custom fields",
				progress: 100,
				votes: 189,
			},
		],
	});

	return (
		<Kanban value={columns} onValueChange={setColumns} getItemValue={itemId}>
			<KanbanBoard className="grid grid-cols-3">
				{Object.entries(columns).map(([colId, features]): React.JSX.Element | null => {
					const col = COLUMNS[colId];
					// Every board key is one of COLUMNS; an unknown one has nothing to render.
					if (col === undefined) {
						return null;
					}
					return (
						<KanbanColumn key={colId} value={colId}>
							<Frame spacing="sm" className="h-full">
								<FrameHeader className="flex flex-row items-center gap-2">
									<div className={cn("size-2 rounded-full", col.color)} />
									<FrameTitle className="capitalize">{col.title}</FrameTitle>
									<Badge variant="outline" size="sm" className="ml-auto">
										{features.length}
									</Badge>
								</FrameHeader>
								<KanbanColumnContent value={colId} className="flex flex-col gap-2 p-0.5">
									{features.map((feature) => (
										<FeatureCard key={feature.id} feature={feature} asHandle />
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
