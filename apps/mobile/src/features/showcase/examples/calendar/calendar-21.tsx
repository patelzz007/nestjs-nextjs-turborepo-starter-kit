import type { DateRangeDraft } from "@workspace/ui-native/lib/calendar";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

const INITIAL: DateRangeDraft = { from: "2026-11-06", to: "2026-11-18" };

export function Calendar21Example(): React.JSX.Element {
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
			numberOfMonths={2}
		/>
	);
}
