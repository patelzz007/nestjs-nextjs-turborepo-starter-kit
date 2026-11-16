import { addLocalDays, type LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { calendarMonthOf, type CalendarMonth } from "@workspace/ui-native/lib/calendar";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

interface Preset {
	readonly label: string;
	readonly days: number;
}

/** Shortcuts forward from today, in days. */
const PRESETS: readonly Preset[] = [
	{ label: "Today", days: 0 },
	{ label: "Tomorrow", days: 1 },
	{ label: "3 days", days: 3 },
	{ label: "Week", days: 7 },
	{ label: "2 weeks", days: 14 },
];

interface PresetButtonProps {
	readonly preset: Preset;
	readonly onPick: (preset: Preset) => void;
}

/** One shortcut: picks its day. */
function PresetButton({ preset, onPick }: PresetButtonProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(preset);
	}, [onPick, preset]);
	return <Button label={preset.label} variant="outline" size="sm" onPress={pick} />;
}

export function Calendar18Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	const [month, setMonth] = React.useState<CalendarMonth>(calendarMonthOf(SAMPLE_TODAY));
	const pickPreset = React.useCallback((preset: Preset): void => {
		const picked = addLocalDays(SAMPLE_TODAY, preset.days);
		setDay(picked);
		setMonth(calendarMonthOf(picked));
	}, []);
	return (
		<View className="rounded-card gap-3 border border-border bg-card p-3">
			<Calendar
				today={SAMPLE_TODAY}
				minDate={SAMPLE_TODAY}
				maxDate={SAMPLE_MAX_DATE}
				locale={SAMPLE_LOCALE}
				value={day}
				onChange={setDay}
				month={month}
				onMonthChange={setMonth}
			/>
			<View className="flex-row flex-wrap gap-2 border-t border-border pt-3">
				{PRESETS.map((preset: Preset): React.JSX.Element => (
					<PresetButton key={preset.label} preset={preset} onPick={pickPreset} />
				))}
			</View>
		</View>
	);
}
