import { addLocalDays, type LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { calendarMonthOf, type CalendarMonth } from "@workspace/ui-native/lib/calendar";
import { ScrollView, View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

interface Preset {
	readonly label: string;
	readonly days: number;
}

/** Shortcuts back from today, in days. */
const PRESETS: readonly Preset[] = [
	{ label: "Today", days: 0 },
	{ label: "Yesterday", days: -1 },
	{ label: "Last week", days: -7 },
	{ label: "Last month", days: -30 },
	{ label: "Last year", days: -365 },
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

/** The earliest day: far enough back for Last year. */
const EARLIEST = "2025-01-01";

export function Calendar15Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	const [month, setMonth] = React.useState<CalendarMonth>(calendarMonthOf(SAMPLE_TODAY));
	const pickPreset = React.useCallback((preset: Preset): void => {
		const picked = addLocalDays(SAMPLE_TODAY, preset.days);
		setDay(picked);
		setMonth(calendarMonthOf(picked));
	}, []);
	return (
		<View className="gap-3">
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
				{PRESETS.map((preset: Preset): React.JSX.Element => (
					<PresetButton key={preset.label} preset={preset} onPick={pickPreset} />
				))}
			</ScrollView>
			<Calendar today={SAMPLE_TODAY} minDate={EARLIEST} maxDate={SAMPLE_TODAY} locale={SAMPLE_LOCALE} value={day} onChange={setDay} month={month} onMonthChange={setMonth} />
		</View>
	);
}
