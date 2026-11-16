import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";
import { View } from "react-native";

export function TimePicker12Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>(null);
	const [submitted, setSubmitted] = React.useState<boolean>(false);
	const submit = React.useCallback((): void => {
		setSubmitted(true);
	}, []);
	return (
		<View className="gap-3">
			<Field label="Pickup time" error={submitted && time === null ? "Pick a pickup time." : undefined}>
				<TimePicker label="Pickup time" value={time} onChange={setTime} placeholder="Pick a time" />
			</Field>
			<Button label="Book" onPress={submit} />
		</View>
	);
}
