import { DateField } from "@workspace/ui-native/components/date-field";
import * as React from "react";
import type { LocalDate } from "@workspace/shared";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

export function Input11Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	return (
		<DateField
			label="Date"
			placeholder="Pick a day"
			value={day}
			onChange={setDay}
			minDate={SAMPLE_MIN_DATE}
			maxDate={SAMPLE_MAX_DATE}
			today={SAMPLE_TODAY}
			locale={SAMPLE_LOCALE}
		/>
	);
}
