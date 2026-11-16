import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

/** Slots already booked, and the lunch hour. */
const BOOKED: readonly string[] = ["09:30", "10:00", "15:30"];

function isBooked(value: string): boolean {
	return value.startsWith("12:") || BOOKED.includes(value);
}

export function TimePicker7Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>(null);
	return <TimePicker label="Appointment" value={time} onChange={setTime} minuteStep={30} isTimeDisabled={isBooked} placeholder="Pick a slot" />;
}
