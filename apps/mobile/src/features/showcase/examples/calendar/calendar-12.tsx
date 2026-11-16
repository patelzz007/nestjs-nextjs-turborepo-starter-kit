import { addLocalDays, type LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { calendarMonthOf, type CalendarMonth } from "@workspace/ui-native/lib/calendar";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

/** The calendar opens four weeks back, so the Today button has somewhere to jump from. */
const WEEKS_BACK_DAYS = -28;
const OPENING_MONTH = calendarMonthOf(addLocalDays(SAMPLE_TODAY, WEEKS_BACK_DAYS));

export function Calendar12Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	const [month, setMonth] = React.useState<CalendarMonth>(OPENING_MONTH);
	const pickToday = React.useCallback((): void => {
		setDay(SAMPLE_TODAY);
		setMonth(calendarMonthOf(SAMPLE_TODAY));
	}, []);
	return (
		<View className="gap-3">
			<Calendar
				today={SAMPLE_TODAY}
				minDate={SAMPLE_MIN_DATE}
				maxDate={SAMPLE_MAX_DATE}
				locale={SAMPLE_LOCALE}
				value={day}
				onChange={setDay}
				month={month}
				onMonthChange={setMonth}
			/>
			<Button label="Today" variant="outline" onPress={pickToday} />
		</View>
	);
}
