import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function ButtonDont1Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Button label="Cancel" onPress={ignorePress} className="flex-1" />
			<Button label="Save" onPress={ignorePress} className="flex-1" />
		</View>
	);
}
