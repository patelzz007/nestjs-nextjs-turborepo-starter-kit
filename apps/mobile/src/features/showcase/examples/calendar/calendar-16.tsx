import type { LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { calendarMonthOf, type CalendarMonth, type DateRangeDraft } from "@workspace/ui-native/lib/calendar";
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
const NO_RANGE: DateRangeDraft = { from: null, to: null };

export function Calendar16Example(): React.JSX.Element {
	const [range, setRange] = React.useState<DateRangeDraft>(NO_RANGE);
	const [month, setMonth] = React.useState<CalendarMonth>(calendarMonthOf(SAMPLE_TODAY));
	const pickPreset = React.useCallback((preset: RangePreset): void => {
		setRange({ from: preset.from, to: preset.to });
		setMonth(calendarMonthOf(preset.from));
	}, []);
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
				value={range}
				onChange={setRange}
				month={month}
				onMonthChange={setMonth}
			/>
		</View>
	);
}
