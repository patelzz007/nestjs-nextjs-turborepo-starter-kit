import type { LocalDate } from "@workspace/shared";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

export function Calendar10Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	return <Calendar today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={day} onChange={setDay} showWeekNumbers />;
}
