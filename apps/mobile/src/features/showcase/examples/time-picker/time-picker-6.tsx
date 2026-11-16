import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

export function TimePicker6Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>(null);
	return <TimePicker label="Opening time" value={time} onChange={setTime} minuteStep={15} min="08:30" max="18:00" placeholder="Pick a time" />;
}
