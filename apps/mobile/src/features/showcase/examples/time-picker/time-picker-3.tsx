import ClockIcon from "lucide-react-native/icons/clock";
import { Field } from "@workspace/ui-native/components/field";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import * as React from "react";
import { parseTypedTime } from "@workspace/ui-native/components/time-picker";

const STEP_MINUTES = 5;
const MINUTES_PER_HOUR = 60;
const TWO_DIGITS = 2;

/** "14:32" → "14:30": to the nearest 5 minutes. */
function snapToStep(value: string): string {
	const [hours = 0, minutes = 0] = value.split(":").map(Number);
	const total = Math.round((hours * MINUTES_PER_HOUR + minutes) / STEP_MINUTES) * STEP_MINUTES;
	return `${String(Math.floor(total / MINUTES_PER_HOUR) % 24).padStart(TWO_DIGITS, "0")}:${String(total % MINUTES_PER_HOUR).padStart(TWO_DIGITS, "0")}`;
}

export function TimePicker3Example(): React.JSX.Element {
	const [text, setText] = React.useState<string>("");
	const [time, setTime] = React.useState<string | null>(null);
	const read = React.useCallback((): void => {
		const parsed = parseTypedTime(text);
		setTime(parsed === null ? null : snapToStep(parsed));
	}, [text]);
	const hint = time === null ? "Type a time; it snaps to 5 minutes." : `Saved as ${time}.`;
	return (
		<Field label="Start" hint={hint}>
			<InputGroup value={text} onChange={setText} onBlur={read} trailingIcon={ClockIcon} placeholder="e.g. 2:30 pm" />
		</Field>
	);
}
