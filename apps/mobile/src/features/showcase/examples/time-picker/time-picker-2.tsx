import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

export function TimePicker2Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>(null);
	return <TimePicker label="Time" value={time} onChange={setTime} placeholder="Pick a time" />;
}
