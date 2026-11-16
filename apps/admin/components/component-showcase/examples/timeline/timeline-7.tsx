import * as React from "react";
import { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator } from "@workspace/ui/components/timeline";

import { cn } from "@workspace/ui/lib/core/utils";

interface RoadmapItem {
	readonly id: string;
	readonly date: string;
	readonly content: React.ReactNode;
	readonly color: string;
}

const roadmapItems: readonly RoadmapItem[] = [
	{
		id: "milestone-1",
		date: "Dec 15, 2025",
		content: (
			<>
				<span className="text-muted-foreground">Completed</span> Beta Program
			</>
		),
		color: "bg-tone-green",
	},
	{
		id: "milestone-2",
		date: "Nov 01, 2025",
		content: (
			<>
				<span className="text-muted-foreground">Completed</span> Usability Testing
			</>
		),
		color: "bg-tone-violet",
	},
	{
		id: "milestone-3",
		date: "Oct 15, 2025",
		content: (
			<>
				<span className="text-muted-foreground">Initiated</span> Design Phase
			</>
		),
		color: "bg-tone-orange",
	},
	{
		id: "milestone-4",
		date: "Aug 01, 2024",
		content: (
			<>
				<span className="text-muted-foreground">Completed</span> Requirements Gathering
			</>
		),
		color: "bg-tone-blue",
	},
	{
		id: "milestone-5",
		date: "Jul 15, 2024",
		content: (
			<>
				<span className="text-muted-foreground">Started</span> Project Kickoff
			</>
		),
		color: "bg-tone-red",
	},
];

export function Timeline7Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Timeline defaultValue={0} className="gap-2.5">
				{roadmapItems.map((item: RoadmapItem, index: number): React.JSX.Element => (
					<TimelineItem
						key={item.id}
						step={index + 1}
						className="group-data-[orientation=vertical]/timeline:not-last:pb-0 has-[+[data-completed]]:[&_[data-slot=timeline-separator]]:bg-foreground/20">
						<TimelineHeader className="flex items-center gap-2.5">
							<TimelineSeparator className="" />
							<TimelineIndicator className={cn("size-2 border-none", item.color)} />
							<TimelineDate className="mb-0 text-[10px] font-semibold text-muted-foreground/60 uppercase">{item.date}</TimelineDate>
						</TimelineHeader>
						<TimelineContent className="text-sm font-medium text-foreground">{item.content}</TimelineContent>
					</TimelineItem>
				))}
			</Timeline>
		</div>
	);
}
