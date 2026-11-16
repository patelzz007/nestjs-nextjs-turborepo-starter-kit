import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";

export function Input14Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("09:30");
	return <TimePicker label="Time" value={time} onChange={setTime} />;
}
