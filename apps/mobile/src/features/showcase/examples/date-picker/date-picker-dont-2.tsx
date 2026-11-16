import type { LocalDate } from "@workspace/shared";
import { DateField } from "@workspace/ui-native/components/date-field";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

export function DatePickerDont2Example(): React.JSX.Element {
	const [day, setDay] = React.useState<LocalDate | null>(null);
	return (
		<DateField
			label="Start date"
			today={SAMPLE_TODAY}
			minDate={SAMPLE_MIN_DATE}
			maxDate={SAMPLE_MAX_DATE}
			locale={SAMPLE_LOCALE}
			value={day}
			onChange={setDay}
			placeholder="Pick a date"
			error={day === null ? "Invalid." : undefined}
		/>
	);
}
