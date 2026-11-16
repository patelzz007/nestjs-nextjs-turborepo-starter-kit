import { addLocalDays, type LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { CalendarField } from "@workspace/ui-native/components/calendar-field";
import { calendarDayMsOf } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
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

/** How a picked day is written under the calendar. */
const LONG_DATE = new Intl.DateTimeFormat(SAMPLE_LOCALE, { dateStyle: "long", timeZone: "UTC" });

/** The earliest day: far enough back for Last year. */
const EARLIEST = "2025-01-01";

interface PresetChipProps {
	readonly preset: Preset;
	readonly onPick: (day: LocalDate) => void;
}

/** One shortcut: picks its day and closes the sheet. */
function PresetChip({ preset, onPick }: PresetChipProps): React.JSX.Element {
	const pick = React.useCallback((): void => {
		onPick(addLocalDays(SAMPLE_TODAY, preset.days));
	}, [onPick, preset.days]);
	return <Button label={preset.label} variant="outline" size="sm" onPress={pick} />;
}

interface PresetSheetProps {
	readonly value: LocalDate | null;
	readonly onChange: (day: LocalDate) => void;
	readonly close: () => void;
}

function PresetSheet({ value, onChange, close }: PresetSheetProps): React.JSX.Element {
	const pick = React.useCallback(
		(day: LocalDate): void => {
			onChange(day);
			close();
		},
		[close, onChange],
	);
	return (
		<View className="gap-3">
			<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
				{PRESETS.map((preset: Preset): React.JSX.Element => (
					<PresetChip key={preset.label} preset={preset} onPick={pick} />
				))}
			</ScrollView>
			<Calendar today={SAMPLE_TODAY} minDate={EARLIEST} maxDate={SAMPLE_TODAY} locale={SAMPLE_LOCALE} value={value} onChange={pick} />
		</View>
	);
}

export function Calendar28Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	const renderSheet = React.useCallback((close: () => void): React.JSX.Element => <PresetSheet value={day} onChange={setDay} close={close} />, [day]);
	return <CalendarField label="Date" summary={day === null ? null : LONG_DATE.format(calendarDayMsOf(day))} placeholder="Pick a date" renderSheet={renderSheet} />;
}
