import { CodeBlock } from "@workspace/ui-native/components/code-block";
import { DateSelector } from "@workspace/ui-native/components/date-selector";
import type { DateSelectorValue } from "@workspace/ui-native/lib/date-selector";
import * as React from "react";
import { View } from "react-native";

import { SAMPLE_LOCALE, SAMPLE_TODAY } from "../example-support";

/** The years the selector offers. */
const MIN_YEAR = 2020;
const MAX_YEAR = 2030;
/** How far the value's JSON is indented. */
const JSON_INDENT = 2;
const INITIAL: DateSelectorValue = { period: "day", operator: "is", startDate: SAMPLE_TODAY };

export function DateSelector1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<DateSelectorValue>(INITIAL);
	return (
		<View className="gap-3">
			<DateSelector today={SAMPLE_TODAY} minYear={MIN_YEAR} maxYear={MAX_YEAR} locale={SAMPLE_LOCALE} value={value} onChange={setValue} variant="card" />
			<CodeBlock code={JSON.stringify(value, null, JSON_INDENT)} language="json" />
		</View>
	);
}
