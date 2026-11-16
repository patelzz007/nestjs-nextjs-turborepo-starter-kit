import { addLocalDays, type LocalDate } from "@workspace/shared";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

/** Four days around today, picked on load. */
const INITIAL: readonly LocalDate[] = [addLocalDays(SAMPLE_TODAY, -3), SAMPLE_TODAY, addLocalDays(SAMPLE_TODAY, 2), addLocalDays(SAMPLE_TODAY, 6)];

export function Calendar4Example(): React.JSX.Element {
	const [days, setDays] = React.useState<readonly LocalDate[]>(INITIAL);
	return <Calendar mode="multiple" today={SAMPLE_TODAY} minDate={SAMPLE_MIN_DATE} maxDate={SAMPLE_MAX_DATE} locale={SAMPLE_LOCALE} value={days} onChange={setDays} />;
}
