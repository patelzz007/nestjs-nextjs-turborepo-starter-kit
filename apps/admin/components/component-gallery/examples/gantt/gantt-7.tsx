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

/** Two-level white-label rollout tree; bars attach to leaf rows by id. */
const RESOURCES: readonly GanttResource[] = [
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "kickoff", title: "Kickoff" },
			{ id: "api", title: "API work" },
			{ id: "frontend", title: "Frontend" },
			{ id: "qa", title: "QA pass" },
		],
	},
	{
		id: "rollout",
		title: "Rollout",
		children: [
			{ id: "staging", title: "Staging deploy" },
			{ id: "signoff", title: "Sign-off" },
			{ id: "live", title: "Go live" },
		],
	},
];

/** Leaf titles for bar labels, resolved from the tree by id. */
const RESOURCE_TITLES: ReadonlyMap<string, string> = new Map(
	RESOURCES.flatMap((group: GanttResource): readonly GanttResource[] => group.children ?? []).map((leaf: GanttResource): readonly [string, string] => [leaf.id, leaf.title]),
);

/** Chained fixture around the sample week: FS arrows plus a milestone gate. */
function buildBars(anchor: Date): readonly GanttEvent[] {
	const week = startOfWeek(startOfDay(anchor), { weekStartsOn: 0 });
	const day = (dayOffset: number): Date => addDays(week, dayOffset);
	// `dependencies` names PREDECESSOR ids: each arrow runs from that bar's
	// end into this one's start. A zero-length event (days 0) is a MILESTONE
	// and renders as a diamond instead of a bar.
	const bar = (resourceId: string, startOffset: number, days: number, color: string, dependencies?: readonly string[], progress?: number): GanttEvent => ({
		id: `bar-${resourceId}`,
		title: RESOURCE_TITLES.get(resourceId) ?? resourceId,
		start: day(startOffset),
		end: day(startOffset + days),
		allDay: true,
		color,
		resourceId,
		dependencies,
		progress,
	});

	return [
		bar("kickoff", -9, 2, "var(--tone-blue)", undefined, 100),
		bar("api", -7, 5, "var(--tone-teal)", ["bar-kickoff"], 80),
		bar("frontend", -4, 5, "var(--tone-violet)", ["bar-kickoff"], 55),
		// waits on BOTH build tracks, so two arrows land on its start
		bar("qa", 2, 3, "var(--tone-red)", ["bar-api", "bar-frontend"], 10),
		bar("staging", 5, 2, "var(--tone-green)", ["bar-qa"]),
		// the gate: a diamond with an arrow in from staging and one out to launch
		bar("signoff", 8, 0, "var(--tone-orange)", ["bar-staging"]),
		bar("live", 9, 1, "var(--tone-teal)", ["bar-signoff"]),
	];
}

const BARS: readonly GanttEvent[] = buildBars(SAMPLE_NOW);

export function Gantt7Example(): React.JSX.Element {
	return (
		<div className="w-full p-4">
			<Card className="w-full py-0">
				<CardContent className="p-0">
					{/* dependencyLines is on by default: any event naming
              `dependencies` gets a finish-to-start arrow from each
              predecessor, drawn under the bars and skipped when either end
              is on a hidden row. Dragging a bar re-anchors its arrows on
              release; the milestone diamond moves like any bar but has no
              resize edges. */}
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
