import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Toggle5Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Toggle label="Default" disabled pressed={false} onChange={ignorePress} />
			<Toggle label="Outline" variant="outline" disabled pressed={false} onChange={ignorePress} />
		</View>
	);
}
