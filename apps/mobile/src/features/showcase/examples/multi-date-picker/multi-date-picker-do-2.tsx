import { Calendar } from "@workspace/ui-native/components/calendar";
import type { DateRangeDraft } from "@workspace/ui-native/lib/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

const NO_RANGE: DateRangeDraft = { from: null, to: null };

export function MultiDatePickerDo2Example(): React.JSX.Element {
	const [range, setRange] = React.useState<DateRangeDraft>(NO_RANGE);
	return <Calendar mode="range" today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={range} onChange={setRange} />;
}
