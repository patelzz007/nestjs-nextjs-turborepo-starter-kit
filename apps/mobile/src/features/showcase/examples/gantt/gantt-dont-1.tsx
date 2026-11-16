import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

const RESOURCES: readonly GanttResource[] = [
	{ id: "api", title: "API" },
	{ id: "screens", title: "Screens" },
];
const BARS: readonly GanttEvent[] = [sampleBar("api", "API", -2, 4, "violet"), sampleBar("screens", "Screens", 2, 3, "teal")];

// The same sprint squeezed into a year: slivers too thin to read or tap.
export function GanttDont1Example(): React.JSX.Element {
	return <Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="year" clock={SAMPLE_CLOCK} showNav={false} />;
}
