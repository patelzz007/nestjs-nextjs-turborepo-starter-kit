import type { LocalDate } from "@workspace/shared";
import { MultiDateField } from "@workspace/ui-native/components/multi-date-field";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_MAX_DATE, SAMPLE_MIN_DATE, SAMPLE_TODAY } from "../example-support";

const NO_DAYS: readonly LocalDate[] = [];
/** The most holidays a person may book: said nowhere on the field. */
const MAX_DAYS = 5;

export function MultiDatePickerDont1Example(): React.JSX.Element {
	const [days, setDays] = React.useState<readonly LocalDate[]>(NO_DAYS);
	return (
		<MultiDateField
			label="Holidays"
			today={SAMPLE_TODAY}
			minDate={SAMPLE_MIN_DATE}
			maxDate={SAMPLE_MAX_DATE}
			locale={SAMPLE_LOCALE}
			value={days}
			onChange={setDays}
			maxDates={MAX_DAYS}
			placeholder="Pick days"
		/>
	);
}
