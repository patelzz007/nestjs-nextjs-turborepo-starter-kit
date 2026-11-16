import { DateSelectorField } from "@workspace/ui-native/components/date-selector";
import type { DateSelectorValue } from "@workspace/ui-native/lib/date-selector";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The years the selector offers. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2030;
const INITIAL: DateSelectorValue = { period: "quarter", operator: "is", year: 2026, quarter: 3 };

export function DateSelector2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<DateSelectorValue>(INITIAL);
	return (
		<DateSelectorField
			label="Reporting period"
			today={SAMPLE_TODAY}
			minYear={MIN_YEAR}
			maxYear={MAX_YEAR}
			locale={SAMPLE_LOCALE}
			value={value}
			onChange={setValue}
			hint="Type Q1 2026 or 2025 in the sheet as a shortcut."
		/>
	);
}
