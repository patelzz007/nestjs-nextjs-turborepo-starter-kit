import type { GanttEvent, GanttResource, GanttResourceReorder } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

/** A two-level task tree; bars attach to the leaf rows by id. */
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

const BARS: readonly GanttEvent[] = [
	sampleBar("brief", "Project brief", -9, 3, "blue", 100),
	sampleBar("scope", "Scope review", -6, 2, "teal", 100),
	sampleBar("wireframes", "Wireframes", -4, 4, "violet", 80),
	sampleBar("visual-design", "Visual design", 0, 5, "red", 35),
	sampleBar("frontend", "Frontend", 3, 7, "green", 10),
	sampleBar("backend", "Backend", 5, 6, "teal"),
	sampleBar("qa", "QA pass", 12, 4, "yellow"),
];

// The leanest setup: one callback gives every row a reorder menu, and one setState keeps the new order.
export function Gantt2Example(): React.JSX.Element {
	const [resources, setResources] = React.useState<readonly GanttResource[]>(INITIAL_RESOURCES);
	// The proposal carries the whole tree with the move applied. Return false to refuse a move.
	const handleResourceReorder = React.useCallback((proposal: GanttResourceReorder): undefined => {
		setResources(proposal.resources);
		return undefined;
	}, []);
	return <Gantt defaultEvents={BARS} resources={resources} defaultScale="month" clock={SAMPLE_CLOCK} onResourceReorder={handleResourceReorder} />;
}
