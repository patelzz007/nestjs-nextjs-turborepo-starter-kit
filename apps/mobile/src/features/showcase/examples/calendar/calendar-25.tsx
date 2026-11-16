import CalendarRangeIcon from "lucide-react-native/icons/calendar-range";
import { Button } from "@workspace/ui-native/components/button";
import { DateRangePicker, type LocalDateRange } from "@workspace/ui-native/components/date-range-picker";
import { calendarDayMsOf } from "@workspace/ui-native/lib/calendar";
import * as React from "react";
import { Text, View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

/** How a picked day is written under the calendar. */
const LONG_DATE = new Intl.DateTimeFormat(SAMPLE_LOCALE, { dateStyle: "long", timeZone: "UTC" });

/** Any complete range can be applied. */
function acceptAny(): null {
	return null;
}

export function Calendar25Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [range, setRange] = React.useState<LocalDateRange | null>(null);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const apply = React.useCallback((next: LocalDateRange): void => {
		setRange(next);
		setOpen(false);
	}, []);
	return (
		<View className="gap-2">
			<Button
				label={range === null ? "Pick a date range" : `${LONG_DATE.format(calendarDayMsOf(range.from))} – ${LONG_DATE.format(calendarDayMsOf(range.to))}`}
				icon={CalendarRangeIcon}
				variant="outline"
				onPress={show}
			/>
			<Text className="text-caption font-sans text-muted-foreground">{range === null ? "No range picked yet." : "Tap to change the range."}</Text>
			<DateRangePicker
				visible={open}
				title="Date range"
				initialRange={range}
				today={SAMPLE_TODAY}
				minDate={SAMPLE_MIN_DATE}
				maxDate={SAMPLE_MAX_DATE}
				locale={SAMPLE_LOCALE}
				validate={acceptAny}
				onApply={apply}
				onClose={hide}
			/>
		</View>
	);
}
