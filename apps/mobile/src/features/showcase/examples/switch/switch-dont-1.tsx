import { Button } from "@workspace/ui-native/components/button";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function SwitchDont1Example(): React.JSX.Element {
	const [checked, setChecked] = React.useState<boolean>(true);
	return (
		<View className="gap-2">
			<Switch label="Push notifications" checked={checked} onChange={setChecked} />
			<Button label="Save" onPress={ignorePress} />
		</View>
	);
}
