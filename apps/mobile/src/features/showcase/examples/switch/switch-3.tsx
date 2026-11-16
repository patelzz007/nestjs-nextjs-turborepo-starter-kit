import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Switch3Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<Switch label="Off and locked" checked={false} disabled onChange={ignorePress} />
			<Switch label="On and locked" checked disabled onChange={ignorePress} />
		</View>
	);
}
