import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

/** The value with the zone it is in. */
function inZone(value: string): string {
	return `${value} · Kuala Lumpur (GMT+8)`;
}

export function TimePicker9Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("09:30");
	return <TimePicker label="Call time" value={time} onChange={setTime} formatTime={inZone} showActions placeholder="Pick a time" />;
}
