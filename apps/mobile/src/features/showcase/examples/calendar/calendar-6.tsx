import { addLocalDays } from "@workspace/shared";
import type { DateRangeDraft } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

/** The range ends this many days after today. */
const RANGE_DAYS = 8;

const INITIAL: DateRangeDraft = { from: addLocalDays(SAMPLE_TODAY, 2), to: addLocalDays(SAMPLE_TODAY, RANGE_DAYS) };

export function Calendar6Example(): React.JSX.Element {
	const [range, setRange] = React.useState<DateRangeDraft>(INITIAL);
	return (
		<Calendar
			mode="range"
			today={SAMPLE_TODAY}
			minDate={SAMPLE_MIN_DATE}
			maxDate={SAMPLE_MAX_DATE}
			locale={SAMPLE_LOCALE}
			value={range}
			onChange={setRange}
			dayShape="circle"
		/>
	);
}
