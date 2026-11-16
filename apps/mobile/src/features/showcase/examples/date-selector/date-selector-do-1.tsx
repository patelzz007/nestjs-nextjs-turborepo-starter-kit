import { DateSelectorField } from "@workspace/ui-native/components/date-selector";
import type { DateSelectorPeriodType, DateSelectorValue } from "@workspace/ui-native/lib/date-selector";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The years the selector offers. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2030;
const INITIAL: DateSelectorValue = { period: "month", operator: "is", year: 2026, month: 10 };
const PERIODS: readonly DateSelectorPeriodType[] = ["month", "quarter", "year"];

export function DateSelectorDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<DateSelectorValue>(INITIAL);
	return (
		<DateSelectorField
			label="Invoices from"
			today={SAMPLE_TODAY}
			minYear={MIN_YEAR}
			maxYear={MAX_YEAR}
			locale={SAMPLE_LOCALE}
			value={value}
			onChange={setValue}
			periodTypes={PERIODS}
		/>
	);
}
