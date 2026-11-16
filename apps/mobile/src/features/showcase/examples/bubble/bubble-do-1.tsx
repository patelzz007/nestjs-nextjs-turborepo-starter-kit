import { Bubble } from "@workspace/ui-native/components/bubble";
import * as React from "react";
import { View } from "react-native";

export function BubbleDo1Example(): React.JSX.Element {
	return (
		<View className="w-full gap-2">
			<Bubble text="Is the build green?" />
			<Bubble text="Yes, all checks passed." variant="sent" />
			<Bubble text="Shipping it." />
		</View>
	);
}
