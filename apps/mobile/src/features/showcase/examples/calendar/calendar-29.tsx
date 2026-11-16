import type { LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { CalendarField } from "@workspace/ui-native/components/calendar-field";
import { calendarDayMsOf, calendarMonthOf, type CalendarMonth, type DateRangeDraft } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { ScrollView, View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

interface RangePreset {
	readonly label: string;
	readonly from: LocalDate;
	readonly to: LocalDate;
}

/** Spans ending today (the examples' fixed today, 15 November 2026). */
const RANGE_PRESETS: readonly RangePreset[] = [
	{ label: "Today", from: "2026-11-15", to: "2026-11-15" },
	{ label: "Yesterday", from: "2026-11-14", to: "2026-11-14" },
	{ label: "Last 7 days", from: "2026-11-09", to: "2026-11-15" },
	{ label: "Last 30 days", from: "2026-10-17", to: "2026-11-15" },
	{ label: "Month to date", from: "2026-11-01", to: "2026-11-15" },
	{ label: "Last month", from: "2026-10-01", to: "2026-10-31" },
	{ label: "Year to date", from: "2026-01-01", to: "2026-11-15" },
	{ label: "Last year", from: "2025-01-01", to: "2025-12-31" },
];

interface RangePresetButtonProps {
	readonly preset: RangePreset;
	readonly onPick: (preset: RangePreset) => void;
}

/** One shortcut: sets both ends of its span. */
function RangePresetButton({ preset, onPick }: RangePresetButtonProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(preset);
	}, [onPick, preset]);
	return <Button label={preset.label} variant="outline" size="sm" onPress={pick} />;
}

/** The earliest day: the start of Last year. */
const EARLIEST = "2025-01-01";
/** The field starts on the last 7 days. */
const INITIAL: DateRangeDraft = { from: "2026-11-09", to: "2026-11-15" };
const SHORT_DATE = new Intl.DateTimeFormat(SAMPLE_LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

interface RangeSheetProps {
	readonly value: DateRangeDraft;
	readonly onChange: (range: DateRangeDraft) => void;
	readonly close: () => void;
}

function RangeSheet({ value, onChange, close }: RangeSheetProps): React.JSX.Element {
	const [month, setMonth] = React.useState<CalendarMonth>(calendarMonthOf(value.from ?? SAMPLE_TODAY));
	const pickPreset = React.useCallback(
		(preset: RangePreset): void => {
			onChange({ from: preset.from, to: preset.to });
			setMonth(calendarMonthOf(preset.from));
		},
		[onChange],
	);
	return (
		<View className="gap-3">
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
				{RANGE_PRESETS.map((preset: RangePreset): React.JSX.Element => (
					<RangePresetButton key={preset.label} preset={preset} onPick={pickPreset} />
				))}
			</ScrollView>
			<Calendar
				mode="range"
				today={SAMPLE_TODAY}
				minDate={EARLIEST}
				maxDate={SAMPLE_TODAY}
				locale={SAMPLE_LOCALE}
				value={value}
				onChange={onChange}
				month={month}
				onMonthChange={setMonth}
			/>
			<Button label="Done" disabled={value.to === null} onPress={close} />
		</View>
	);
}

export function Calendar29Example(): React.JSX.Element {
	const [range, setRange] = React.useState<DateRangeDraft>(INITIAL);
	const summary = range.from === null || range.to === null ? null : `${SHORT_DATE.format(calendarDayMsOf(range.from))} – ${SHORT_DATE.format(calendarDayMsOf(range.to))}`;
	const renderSheet = React.useCallback((close: () => void): React.JSX.Element => <RangeSheet value={range} onChange={setRange} close={close} />, [range]);
	return <CalendarField label="Date range" summary={summary} placeholder="Pick a date range" renderSheet={renderSheet} />;
}
