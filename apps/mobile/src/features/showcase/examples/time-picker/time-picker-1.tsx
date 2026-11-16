import { Card } from "@workspace/ui-native/components/card";
import { TimePickerPanel } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

export function TimePicker1Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("09:30");
	return (
		<Card>
			<TimePickerPanel value={time} onChange={setTime} minuteStep={5} />
		</Card>
	);
}
