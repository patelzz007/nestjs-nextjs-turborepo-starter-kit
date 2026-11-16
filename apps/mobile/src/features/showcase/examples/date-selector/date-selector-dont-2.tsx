import { DateSelectorField } from "@workspace/ui-native/components/date-selector";
import type { DateSelectorValue } from "@workspace/ui-native/lib/date-selector";
import * as React from "react";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The years the selector offers. */
const MIN_YEAR = 1940;
const MAX_YEAR = 2026;
const INITIAL: DateSelectorValue = { period: "day", operator: "is" };

export function DateSelectorDont2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<DateSelectorValue>(INITIAL);
	return <DateSelectorField label="Date of birth" today={SAMPLE_TODAY} minYear={MIN_YEAR} maxYear={MAX_YEAR} locale={SAMPLE_LOCALE} value={value} onChange={setValue} />;
}
