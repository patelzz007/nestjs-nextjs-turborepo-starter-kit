import { Bubble } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { View } from "react-native";

export function BubbleDont2Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			<Bubble text="Payment captured." tone="destructive" />
			<Bubble text="Receipt sent." tone="destructive" />
		</View>
	);
}
