import type { LocalDate } from "@workspace/shared";
import { DateField } from "@workspace/ui-native/components/date-field";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The earliest birth date offered: the year list in the field's calendar is the quick way back. */
const EARLIEST = "1940-01-01";

export function Calendar26Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	return (
		<DateField
			label="Date of birth"
			today={SAMPLE_TODAY}
			minDate={EARLIEST}
			maxDate={SAMPLE_TODAY}
			locale={SAMPLE_LOCALE}
			value={day}
			onChange={setDay}
			placeholder="Pick a date"
			hint="Tap the year in the calendar to jump to it."
		/>
	);
}
