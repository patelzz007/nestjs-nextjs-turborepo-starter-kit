"use client";

// The Gantt the Do / Don't pairs show: a short project on the sample week, grouped under headings or flat, opened on
// the scale a pair asks for.

import { Gantt } from "@workspace/ui/components/gantt/gantt";
import { GanttNav } from "@workspace/ui/components/gantt/gantt-nav";
import type { GanttClock, GanttEvent, GanttResource, GanttScale } from "@workspace/ui/components/gantt/gantt-types";
import { GanttView } from "@workspace/ui/components/gantt/gantt-view";
import { addDays, parseISO, startOfWeek } from "date-fns";
import type * as React from "react";

/** The sample clock: Wednesday 17 June 2026, 09:30 — fixed so the timeline always opens on the same bars. */
const SAMPLE_NOW = parseISO("2026-06-17T09:30:00");
const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};
const WEEK = startOfWeek(SAMPLE_NOW);

/** One task: its row, its title, its first day from the sample week and how many days it runs. */
type TaskSpec = readonly [string, string, number, number, string];

const TASKS: readonly TaskSpec[] = [
	["brief", "Project brief", 0, 2, "var(--tone-blue)"],
	["wireframes", "Wireframes", 2, 3, "var(--tone-violet)"],
	["frontend", "Frontend", 4, 4, "var(--tone-green)"],
	["qa", "QA pass", 8, 2, "var(--tone-yellow)"],
];

const BARS: readonly GanttEvent[] = TASKS.map(([resourceId, title, startOffset, days, color]: TaskSpec): GanttEvent => ({
	id: `bar-${resourceId}`,
	title,
	start: addDays(WEEK, startOffset),
	end: addDays(WEEK, startOffset + days),
	allDay: true,
	color,
	resourceId,
}));

const GROUPED: readonly GanttResource[] = [
	{ id: "plan", title: "Planning", children: [{ id: "brief", title: "Project brief" }] },
	{ id: "design", title: "Design", children: [{ id: "wireframes", title: "Wireframes" }] },
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "qa", title: "QA pass" },
		],
	},
];

const FLAT: readonly GanttResource[] = TASKS.map(([id, title]: TaskSpec): GanttResource => ({ id, title }));

export interface GuidelineGanttProps {
	readonly scale: GanttScale;
	/** Rows under group headings, or one flat list. */
	readonly grouped: boolean;
}

export function GuidelineGantt({ scale, grouped }: GuidelineGanttProps): React.JSX.Element {
	return (
		<Gantt defaultEvents={BARS} resources={grouped ? GROUPED : FLAT} defaultScale={scale} clock={SAMPLE_CLOCK} className="h-80 w-full">
			<GanttNav />
			<GanttView />
		</Gantt>
	);
}
