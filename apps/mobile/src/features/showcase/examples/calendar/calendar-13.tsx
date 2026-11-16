import type { LocalDate } from "@workspace/shared";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** Ten years either side of today. */
const FIRST_DAY = "2016-01-01";
const LAST_DAY = "2036-12-31";

export function Calendar13Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(SAMPLE_TODAY);
	return <Calendar today={SAMPLE_TODAY} minDate={FIRST_DAY} maxDate={LAST_DAY} locale={SAMPLE_LOCALE} value={day} onChange={setDay} variant="card" />;
}
