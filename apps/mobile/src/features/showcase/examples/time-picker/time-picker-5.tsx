import { TimePicker } from "@workspace/ui-native/components/time-picker";
import * as React from "react";
import { Text, View } from "react-native";

export function TimePicker5Example(): React.JSX.Element {
	const [time, setTime] = React.useState<string | null>("08:00");
	return (
		<View className="flex-row items-center justify-between">
			<Text className="text-body-lg font-sans text-foreground">Daily digest at</Text>
			<TimePicker label="Digest time" value={time} onChange={setTime} hourCycle={12} hoursOnly size="sm" className="w-36" />
		</View>
	);
}
