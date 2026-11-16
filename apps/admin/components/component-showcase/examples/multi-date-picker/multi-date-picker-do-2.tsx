import * as React from "react";
import { Calendar } from "@workspace/ui/components/calendar";

/** The kit calendar's range, read off its own props. */
type DateRange = NonNullable<Extract<React.ComponentProps<typeof Calendar>, { mode: "range" }>["selected"]>;

export function MultiDatePickerDo2Example(): React.JSX.Element {
	const [range, setRange] = React.useState<DateRange | undefined>();
	return <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={1} />;
}
