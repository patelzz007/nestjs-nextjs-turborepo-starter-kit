import { Bubble } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { View } from "react-native";

export function BubbleDo2Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			<Bubble text="Payment captured." />
			<Bubble text="Card declined: ask for another card." tone="destructive" />
		</View>
	);
}
