import { Kbd } from "@workspace/ui-native/components/kbd";
import * as React from "react";
import { View } from "react-native";

export function Kbd1Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<Kbd label="Ctrl" />
			<Kbd label="⌘K" />
			<Kbd label="Ctrl + B" />
		</View>
	);
}
