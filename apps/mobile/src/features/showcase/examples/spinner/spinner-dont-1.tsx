import { View } from "react-native";
import { Spinner } from "@workspace/ui-native/components/spinner";
import * as React from "react";

// Three spinners on one screen, none saying what it waits for.

export function SpinnerDont1Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Spinner />
			<Spinner />
			<Spinner />
		</View>
	);
}
