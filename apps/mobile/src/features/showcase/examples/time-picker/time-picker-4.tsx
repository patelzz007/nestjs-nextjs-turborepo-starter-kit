import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

export function TimePicker4Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("14:45:30");
	return <TimePicker label="Time" value={time} onChange={setTime} hourCycle={12} withSeconds />;
}
