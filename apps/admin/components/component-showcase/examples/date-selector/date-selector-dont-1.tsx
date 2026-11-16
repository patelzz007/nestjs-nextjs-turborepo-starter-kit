import * as React from "react";
import { DateSelector, type DateSelectorValue } from "@workspace/ui/components/date-selector";

export function DateSelectorDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<DateSelectorValue | undefined>();
	return <DateSelector value={value} onChange={setValue} label="Invoice period" periodTypes={["day"]} />;
}
