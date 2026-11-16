import type { LocalDate } from "@workspace/shared";
import { Button } from "@workspace/ui-native/components/button";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";
import { calendarMonthOf, type CalendarMonth } from "@workspace/ui-native/lib/calendar";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

/** The month today is in: where the button brings the view back to. */
const THIS_MONTH = calendarMonthOf(SAMPLE_TODAY);

export function Calendar11Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>("2026-08-12");
	const [month, setMonth] = React.useState<CalendarMonth>(calendarMonthOf("2026-08-12"));
	const showThisMonth = React.useCallback((): void => {
		setMonth(THIS_MONTH);
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
			<Button label="Current month" variant="outline" onPress={showThisMonth} />
		</View>
	);
}
