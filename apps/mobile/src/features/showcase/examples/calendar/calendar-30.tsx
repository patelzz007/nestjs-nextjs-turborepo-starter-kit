import { Button } from "@workspace/ui-native/components/button";
import { CalendarField } from "@workspace/ui-native/components/calendar-field";
import { TimePicker } from "@workspace/ui-native/components/time-picker";
import { calendarDayMsOf, type DateRangeDraft } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

const SHORT_DATE = new Intl.DateTimeFormat(SAMPLE_LOCALE, { day: "numeric", month: "short", timeZone: "UTC" });

interface Span {
	readonly range: DateRangeDraft;
	readonly start: string | null;
	readonly end: string | null;
}

/** The span starts on the 12th of this month. */
const INITIAL: Span = { range: { from: "2026-11-12", to: null }, start: "09:00:00", end: "17:30:00" };

interface SpanSheetProps {
	readonly value: Span;
	readonly onChange: (value: Span) => void;
	readonly close: () => void;
}

function SpanSheet({ value, onChange, close }: SpanSheetProps): React.JSX.Element {
	const setRange = React.useCallback(
		(range: DateRangeDraft): void => {
			onChange({ ...value, range });
		},
		[onChange, value],
	);
	const setStart = React.useCallback(
		(start: string | null): void => {
			onChange({ ...value, start });
		},
		[onChange, value],
	);
	const setEnd = React.useCallback(
		(end: string | null): void => {
			onChange({ ...value, end });
		},
		[onChange, value],
	);
	return (
		<View className="gap-3">
			<Calendar mode="range" today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={value.range} onChange={setRange} />
			<View className="flex-row gap-3">
				<TimePicker label="Start time" value={value.start} onChange={setStart} withSeconds className="flex-1" />
				<TimePicker label="End time" value={value.end} onChange={setEnd} withSeconds className="flex-1" />
			</View>
			<Button label="Done" disabled={value.range.to === null} onPress={close} />
		</View>
	);
}

export function Calendar30Example(): React.JSX.Element {
	const [span, setSpan] = React.useState<Span>(INITIAL);
	const { range, start, end } = span;
	const summary =
		range.from === null || range.to === null || start === null || end === null
			? null
			: `${SHORT_DATE.format(calendarDayMsOf(range.from))} ${start} – ${SHORT_DATE.format(calendarDayMsOf(range.to))} ${end}`;
	const renderSheet = React.useCallback((close: () => void): React.JSX.Element => <SpanSheet value={span} onChange={setSpan} close={close} />, [span]);
	return <CalendarField label="When" summary={summary} placeholder="Pick dates and times" renderSheet={renderSheet} />;
}
