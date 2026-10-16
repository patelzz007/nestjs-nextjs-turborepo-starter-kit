"use client";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Gantt, type GanttTreePanelConfig } from "@workspace/ui/components/gantt/gantt";
import { GanttNav } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttResource } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { addDays, startOfDay, startOfWeek } from "date-fns";
import type * as React from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 local — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = new Date("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

const TREE_PANEL: GanttTreePanelConfig = { width: 240 };

/** Two-level white-label delivery tree; bars attach to leaf rows by id. A
 * NODE can carry its own plan too: the Implementation group ghosts a band
 * for the window the whole phase was booked into. */
function buildResources(anchor: Date): readonly GanttResource[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	return [
		{
			id: "discovery",
			title: "Discovery",
			children: [
				{ id: "kickoff", title: "Kickoff workshop" },
				{ id: "requirements", title: "Requirements" },
			],
		},
		{
			id: "implementation",
			title: "Implementation",
			baselineStart: day(-3),
			baselineEnd: day(6),
			children: [
				{ id: "integration", title: "API integration" },
				{ id: "migration", title: "Data migration" },
				{ id: "hardening", title: "Security hardening" },
			],
		},
		{
			id: "launch",
			title: "Launch",
			children: [{ id: "handover", title: "Handover" }],
		},
	];
}

/** Leaf titles for bar labels, resolved from the tree by id. */
function leafTitles(resources: readonly GanttResource[]): ReadonlyMap<string, string> {
	return new Map(
		resources.flatMap((group: GanttResource): readonly GanttResource[] => group.children ?? []).map((leaf: GanttResource): readonly [string, string] => [leaf.id, leaf.title]),
	);
}

/** As-built fixture around the sample week: frozen plan vs actual dates. */
function buildBars(anchor: Date, titles: ReadonlyMap<string, string>): readonly GanttEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	// The baseline pair is the plan as it was frozen; start/end is what really
	// happened. Equal baseline instants (plannedDays 0) mark a planned
	// milestone, drawn as a diamond instead of a ghost bar.
	const bar = (resourceId: string, startOffset: number, days: number, plannedOffset: number, plannedDays: number, color: string, progress?: number): GanttEvent => ({
		id: `bar-${resourceId}`,
		title: titles.get(resourceId) ?? resourceId,
		start: day(startOffset),
		end: day(startOffset + days),
		baselineStart: day(plannedOffset),
		baselineEnd: day(plannedOffset + plannedDays),
		allDay: true,
		color,
		resourceId,
		progress,
	});

	return [
		// delivered exactly to plan
		bar("kickoff", -9, 2, -9, 2, "var(--tone-blue)", 100),
		// ran a day over its planned window
		bar("requirements", -7, 4, -7, 3, "var(--tone-teal)", 100),
		// started a day late and carried the slip through
		bar("integration", -2, 5, -3, 5, "var(--tone-violet)", 60),
		// tracking a day ahead of plan
		bar("migration", 1, 3, 1, 4, "var(--tone-green)", 30),
		// slipped on both ends
		bar("hardening", 4, 4, 3, 3, "var(--tone-teal)", 0),
		// planned milestone (diamond) vs the day the handover actually took
		bar("handover", 9, 1, 8, 0, "var(--tone-orange)"),
	];
}

const RESOURCES: readonly GanttResource[] = buildResources(SAMPLE_NOW);
const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW, leafTitles(RESOURCES));

export function Gantt6Example(): React.JSX.Element {
	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					{/* baselineBars is on by default: any event carrying baselineStart
              and baselineEnd ghosts its planned window behind the bar, and
              dragging a bar re-times the actual dates while the plan holds
              still. Bars expose data-baseline-variance="early|late|on-time"
              for consumer styling, and the tooltip names the planned range. */}
					<Gantt
						defaultEvents={BARS}
						resources={RESOURCES}
						defaultScale="month"
						scheduleMode="single"
						clock={SAMPLE_CLOCK}
						treePanel={TREE_PANEL}
						className="h-[480px] w-full">
						<GanttNav />
						<GanttView />
					</Gantt>
				</CardContent>
			</Card>
		</div>
	);
}
