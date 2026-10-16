"use client";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import { GanttNav } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttResource, GanttResourceReorder } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import type * as React from "react";
import { useCallback, useState } from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

const TREE_PANEL: GanttTreePanelConfig = { width: 240 };

/** Two-level white-label task tree; bars attach to leaf rows by id. */
const INITIAL_RESOURCES: readonly GanttResource[] = [
	{
		id: "planning",
		title: "Planning",
		children: [
			{ id: "brief", title: "Project brief" },
			{ id: "scope", title: "Scope review" },
		],
	},
	{
		id: "design",
		title: "Design",
		children: [
			{ id: "wireframes", title: "Wireframes" },
			{ id: "visual-design", title: "Visual design" },
		],
	},
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "backend", title: "Backend" },
			{ id: "qa", title: "QA pass" },
		],
	},
];

/** Small white-label fixture built around the sample week. */
function buildBars(anchor: Date): readonly GanttEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	const bar = (resourceId: string, title: string, startOffset: number, days: number, color: string, progress?: number): GanttEvent => ({
		id: `bar-${resourceId}`,
		title,
		start: day(startOffset),
		end: day(startOffset + days),
		allDay: true,
		color,
		resourceId,
		progress,
	});

	return [
		bar("brief", "Project brief", -9, 3, "var(--tone-blue)", 100),
		bar("scope", "Scope review", -6, 2, "var(--tone-teal)", 100),
		bar("wireframes", "Wireframes", -4, 4, "var(--tone-violet)", 80),
		bar("visual-design", "Visual design", 0, 5, "var(--tone-red)", 35),
		bar("frontend", "Frontend", 3, 7, "var(--tone-green)", 10),
		bar("backend", "Backend", 5, 6, "var(--tone-teal)"),
		bar("qa", "QA pass", 12, 4, "var(--tone-yellow)"),
	];
}

const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW);

export function Gantt2Example(): React.JSX.Element {
	// Controlled tree so the rows can be dragged into a new order. Wiring
	// onResourceReorder is all it takes to reveal the drag grip on each row.
	const [resources, setResources] = useState<readonly GanttResource[]>(INITIAL_RESOURCES);

	// The proposal carries the whole tree with the move applied, so a reorder
	// is one setState. Return false from here to reject a drop.
	const handleResourceReorder = useCallback((proposal: GanttResourceReorder): undefined => {
		setResources(proposal.resources);
		return undefined;
	}, []);

	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					<Gantt
						defaultEvents={BARS}
						resources={resources}
						defaultScale="month"
						clock={SAMPLE_CLOCK}
						treePanel={TREE_PANEL}
						onResourceReorder={handleResourceReorder}
						className="h-[480px] w-full">
						<GanttNav />
						<GanttView />
					</Gantt>
				</CardContent>
			</Card>
		</div>
	);
}
