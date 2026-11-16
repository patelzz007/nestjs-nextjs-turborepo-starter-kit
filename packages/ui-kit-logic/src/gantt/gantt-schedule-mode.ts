// How a Gantt row schedules its work: one bar at a time, or several side by side. Shared by the web and native
// kits' stores and by the view layout.

import type { GanttResource, GanttScheduleMode } from "./gantt-types";

/** The mode a row takes when neither it nor the chart says otherwise. */
export const DEFAULT_SCHEDULE_MODE: GanttScheduleMode = "multiple";

/** A row's schedule mode: its own, else the chart's, else the default. */
export function resolveScheduleMode(node: GanttResource | null | undefined, scheduleMode: GanttScheduleMode | undefined): GanttScheduleMode {
	return node?.scheduleMode ?? scheduleMode ?? DEFAULT_SCHEDULE_MODE;
}
