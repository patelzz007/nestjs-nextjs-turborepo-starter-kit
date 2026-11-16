import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";

import { SAMPLE_CLOCK, sampleDay } from "./gantt-sample";

/** The tree; the Implementation group carries its own planned window, drawn as a band across the whole group. */
const RESOURCES: readonly GanttResource[] = [
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
		baselineStart: sampleDay(-3),
		baselineEnd: sampleDay(6),
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

const TITLES: Readonly<Record<string, string>> = {
	kickoff: "Kickoff workshop",
	requirements: "Requirements",
	integration: "API integration",
	migration: "Data migration",
	hardening: "Security hardening",
	handover: "Handover",
};

/** A bar with the plan it was frozen at: start and length as built, and as planned (0 planned days: a milestone). */
function asBuilt(resourceId: string, startOffset: number, days: number, plannedOffset: number, plannedDays: number, color: string, progress?: number): GanttEvent {
	return {
		id: `bar-${resourceId}`,
		title: TITLES[resourceId] ?? resourceId,
		start: sampleDay(startOffset),
		end: sampleDay(startOffset + days),
		allDay: true,
		color,
		resourceId,
		progress,
		baselineStart: sampleDay(plannedOffset),
		baselineEnd: sampleDay(plannedOffset + plannedDays),
	};
}

const BARS: readonly GanttEvent[] = [
	asBuilt("kickoff", -9, 2, -9, 2, "blue", 100),
	asBuilt("requirements", -7, 4, -7, 3, "teal", 100),
	asBuilt("integration", -2, 5, -3, 5, "violet", 60),
	asBuilt("migration", 1, 3, 1, 4, "green", 30),
	asBuilt("hardening", 4, 4, 3, 3, "teal", 0),
	asBuilt("handover", 9, 1, 8, 0, "orange"),
];

// The frozen plan ghosted under each bar: late work in red, early and on-time work in grey.
export function Gantt6Example(): React.JSX.Element {
	return <Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="month" clock={SAMPLE_CLOCK} />;
}
