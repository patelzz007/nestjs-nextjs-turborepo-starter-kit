import type { LocalDate } from "@workspace/shared";
import { Calendar } from "@workspace/ui-native/components/calendar";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The earliest day: far enough back that the month and year lists are the quick way there. */
const EARLIEST = "1980-07-01";

export function Calendar8Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>("1994-03-21");
	return <Calendar today={SAMPLE_TODAY} minDate={EARLIEST} maxDate={SAMPLE_TODAY} locale={SAMPLE_LOCALE} value={day} onChange={setDay} variant="card" />;
}
