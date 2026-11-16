import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";
import { View } from "react-native";

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const TWO_DIGITS = 2;

function minutesOf(value: string): number {
	const [hours = 0, minutes = 0] = value.split(":").map(Number);
	return hours * MINUTES_PER_HOUR + minutes;
}

function shift(value: string, by: number): string {
	const total = (((minutesOf(value) + by) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	return `${String(Math.floor(total / MINUTES_PER_HOUR)).padStart(TWO_DIGITS, "0")}:${String(total % MINUTES_PER_HOUR).padStart(TWO_DIGITS, "0")}`;
}

export function TimePicker8Example(): React.JSX.Element {
	const [start, setStart] = React.useState<string | null>("09:00");
	const [end, setEnd] = React.useState<string | null>("10:00");
	// Moving the start moves the end by as much, keeping the meeting's length.
	const moveStart = React.useCallback(
		(next: string | null): void => {
			if (next !== null && start !== null && end !== null) {
				setEnd(shift(end, minutesOf(next) - minutesOf(start)));
			}
			setStart(next);
		},
		[end, start],
	);
	return (
		<View className="flex-row gap-3">
			<TimePicker label="Start" value={start} onChange={moveStart} className="flex-1" />
			<TimePicker label="End" value={end} onChange={setEnd} min={start ?? undefined} className="flex-1" />
		</View>
	);
}
