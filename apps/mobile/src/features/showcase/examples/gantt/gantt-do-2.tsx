import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

const RESOURCES: readonly GanttResource[] = [
	{
		id: "design",
		title: "Design",
		children: [
			{ id: "wireframes", title: "Wireframes" },
			{ id: "visuals", title: "Visuals" },
		],
	},
	{
		id: "build",
		title: "Build",
		children: [
			{ id: "frontend", title: "Frontend" },
			{ id: "backend", title: "Backend" },
		],
	},
];
const BARS: readonly GanttEvent[] = [
	sampleBar("wireframes", "Wireframes", -4, 4, "violet", 100),
	sampleBar("visuals", "Visuals", 0, 4, "red", 40),
	sampleBar("frontend", "Frontend", 3, 6, "green", 10),
	sampleBar("backend", "Backend", 4, 5, "teal"),
];

// Rows under a few headings: each group rolls its work up, and folds away when it is not the one being read.
export function GanttDo2Example(): React.JSX.Element {
	return <Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="month" clock={SAMPLE_CLOCK} showNav={false} />;
}
