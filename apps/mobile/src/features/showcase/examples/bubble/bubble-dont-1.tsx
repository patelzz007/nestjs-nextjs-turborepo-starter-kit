import { Bubble } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { View } from "react-native";

export function BubbleDont1Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			<Bubble text="Is the build green?" tone="tinted" />
			<Bubble text="Yes, all checks passed." variant="sent" tone="secondary" />
			<Bubble text="Shipping it." tone="outline" />
		</View>
	);
}
