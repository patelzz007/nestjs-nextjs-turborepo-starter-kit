import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

export function TimePickerDo1Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>(null);
	return <TimePicker label="Start" value={time} onChange={setTime} minuteStep={15} />;
}
