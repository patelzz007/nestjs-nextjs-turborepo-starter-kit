import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

/** "Now", as the caller reads the clock (fixed for the example). */
const NOW = "11:20";

export function TimePicker10Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("09:30");
	return <TimePicker label="Reminder" value={time} onChange={setTime} confirm showActions now={NOW} />;
}
