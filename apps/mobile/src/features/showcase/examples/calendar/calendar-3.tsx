import { addLocalDays, type LocalDate } from "@workspace/shared";
import { calendarDayMsOf, type DateRangeDraft } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_TODAY } from "../example-support";

/** `Date#getUTCDay` for Saturday and Sunday. */
const SATURDAY = 6;
const SUNDAY = 0;

/** Two spans that are already booked. */
const BOOKED: readonly { readonly from: LocalDate; readonly to: LocalDate }[] = [
	{ from: "2026-11-24", to: "2026-11-26" },
	{ from: "2026-12-08", to: "2026-12-11" },
];

/** Past days, today, weekends and the booked spans cannot be picked. */
function isUnavailable(day: LocalDate): boolean {
	const weekday = new Date(calendarDayMsOf(day)).getUTCDay();
	const isBooked = BOOKED.some((span: { readonly from: LocalDate; readonly to: LocalDate }): boolean => day >= span.from && day <= span.to);
	return day <= SAMPLE_TODAY || weekday === SATURDAY || weekday === SUNDAY || isBooked;
}

const NO_RANGE: DateRangeDraft = { from: null, to: null };

/** The first day that can be picked: tomorrow. */
const FIRST_OPEN_DAY = addLocalDays(SAMPLE_TODAY, 1);

export function Calendar3Example(): React.JSX.Element {
	const [range, setRange] = React.useState<DateRangeDraft>(NO_RANGE);
	return (
		<Calendar
			mode="range"
			today={SAMPLE_TODAY}
			minDate={FIRST_OPEN_DAY}
			maxDate={SAMPLE_MAX_DATE}
			locale={SAMPLE_LOCALE}
			value={range}
			onChange={setRange}
			isUnavailable={isUnavailable}
		/>
	);
}
