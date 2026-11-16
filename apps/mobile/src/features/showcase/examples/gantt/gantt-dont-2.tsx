import type { GanttEvent, GanttResource } from "@workspace/ui-kit-logic";
import { Gantt } from "@workspace/ui-native/components/gantt";
import * as React from "react";

import { SAMPLE_CLOCK, sampleBar } from "./gantt-sample";

const TASKS: readonly string[] = ["Wireframes", "Visuals", "Copy", "Frontend", "Backend", "Search", "Billing", "QA", "Docs", "Launch"];
const STAGGER_DAYS = 2;
const TASK_DAYS = 3;
const RESOURCES: readonly GanttResource[] = TASKS.map((title): GanttResource => ({ id: title.toLowerCase(), title }));
const BARS: readonly GanttEvent[] = TASKS.map((title, index): GanttEvent => sampleBar(title.toLowerCase(), title, index * STAGGER_DAYS - TASK_DAYS, TASK_DAYS, "teal"));

// Ten flat rows: no heading says what belongs together, and nothing folds away.
export function GanttDont2Example(): React.JSX.Element {
	return <Gantt defaultEvents={BARS} resources={RESOURCES} defaultScale="month" clock={SAMPLE_CLOCK} showNav={false} />;
}
