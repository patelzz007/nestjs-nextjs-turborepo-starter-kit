// What the EventCalendar examples share: a fixed clock (Wednesday 17 June 2026, 09:30) so the calendar always
// opens on the same events, times counted from the sample week's Sunday, and the legend that names each tone.

import type { EventCalendarTone } from "@workspace/ui-kit-logic";
import { eventToneClass, type EventCalendarClock } from "@workspace/ui-native/lib/event-calendar";
import * as React from "react";
import { Text, View } from "react-native";

/** The sample week's Sunday, 14 June 2026 (months count from 0, so June is 5). */
const SAMPLE_YEAR = 2026;
const SAMPLE_MONTH = 5;
const SAMPLE_SUNDAY = 14;
/** The sample day is Wednesday, three days into the week. */
export const SAMPLE_WEEKDAY = 3;
const MINUTES_PER_HOUR = 60;

/** `hour` (fractions allowed: 10.5 is 10:30) on the day `dayOffset` days after the sample Sunday, on this device. */
export function atHour(dayOffset: number, hour: number): Date {
	const whole = Math.floor(hour);
	return new Date(SAMPLE_YEAR, SAMPLE_MONTH, SAMPLE_SUNDAY + dayOffset, whole, Math.round((hour - whole) * MINUTES_PER_HOUR));
}

/** Midnight, `dayOffset` days after the sample Sunday. */
export function sampleDay(dayOffset: number): Date {
	return atHour(dayOffset, 0);
}

export const SAMPLE_NOW = atHour(SAMPLE_WEEKDAY, 9.5);

export const SAMPLE_CLOCK: EventCalendarClock = {
	nowEpochMs(): number {
		return SAMPLE_NOW.getTime();
	},
};

/** A legend of tones: each swatch paints the same tone as its events. */
export function ToneLegend({ entries }: { readonly entries: readonly { readonly tone: EventCalendarTone; readonly label: string }[] }): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap gap-x-4 gap-y-1">
			{entries.map((entry): React.JSX.Element => (
				<View key={entry.label} className="flex-row items-center gap-1.5">
					<View className={`size-2.5 rounded-sm ${eventToneClass(entry.tone)}`} />
					<Text className="text-caption font-sans text-muted-foreground">{entry.label}</Text>
				</View>
			))}
		</View>
	);
}
