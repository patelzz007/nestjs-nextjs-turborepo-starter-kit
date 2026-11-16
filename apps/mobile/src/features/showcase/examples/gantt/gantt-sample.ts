// What the Gantt examples share: a fixed clock (Wednesday 17 June 2026, 09:30) so the timeline always opens on
// the same bars, the days of the sample week counted from its Sunday, and a bar builder.

import type { GanttClock, GanttEvent } from "@workspace/ui-kit-logic";

/** The sample week's Sunday, 14 June 2026 (months count from 0, so June is 5). */
const SAMPLE_YEAR = 2026;
const SAMPLE_MONTH = 5;
const SAMPLE_SUNDAY = 14;
/** The sample time: Wednesday, three days into the week, at 09:30. */
const SAMPLE_WEEKDAY = 3;
const SAMPLE_HOUR = 9;
const SAMPLE_MINUTE = 30;

/** Midnight (on this device) `offset` days after the sample week's Sunday. */
export function sampleDay(offset: number): Date {
	return new Date(SAMPLE_YEAR, SAMPLE_MONTH, SAMPLE_SUNDAY + offset);
}

/** The sample "now", on this device. */
export const SAMPLE_NOW = new Date(SAMPLE_YEAR, SAMPLE_MONTH, SAMPLE_SUNDAY + SAMPLE_WEEKDAY, SAMPLE_HOUR, SAMPLE_MINUTE);

export const SAMPLE_CLOCK: GanttClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

/** An all-day bar on row `resourceId`, `days` long from `startOffset` days after the sample Sunday. */
export function sampleBar(resourceId: string, title: string, startOffset: number, days: number, color: string, progress?: number): GanttEvent {
	return { id: `bar-${resourceId}`, title, start: sampleDay(startOffset), end: sampleDay(startOffset + days), allDay: true, color, resourceId, progress };
}
