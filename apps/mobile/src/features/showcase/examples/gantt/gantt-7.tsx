import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

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

/** A bar that waits for `dependencies` (the ids of its predecessors): an arrow runs from each one's end to its start. */
function chained(resourceId: string, title: string, startOffset: number, days: number, color: string, dependencies?: readonly string[], progress?: number): GanttEvent {
	return { ...sampleBar(resourceId, title, startOffset, days, color, progress), dependencies };
}

// QA waits on both build tracks; a zero-length sign-off gate (a milestone diamond) opens the go-live step.
const BARS: readonly GanttEvent[] = [
	chained("kickoff", "Kickoff", -9, 2, "blue", undefined, 100),
	chained("api", "API work", -7, 5, "teal", ["bar-kickoff"], 80),
	chained("frontend", "Frontend", -4, 5, "violet", ["bar-kickoff"], 55),
	chained("qa", "QA pass", 2, 3, "red", ["bar-api", "bar-frontend"], 10),
	chained("staging", "Staging deploy", 5, 2, "green", ["bar-qa"]),
	chained("signoff", "Sign-off", 8, 0, "orange", ["bar-staging"]),
	chained("live", "Go live", 9, 1, "teal", ["bar-signoff"]),
];

export function Gantt7Example(): React.JSX.Element {
	return <Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="month" clock={SAMPLE_CLOCK} />;
}
