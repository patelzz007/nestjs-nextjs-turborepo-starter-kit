import BoldIcon from "lucide-react-native/icons/bold";
import { Button } from "@workspace/ui-native/components/button";
import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

export function Toggle4Example(): React.JSX.Element {
	const [text, setText] = React.useState<boolean>(false);
	const [icon, setIcon] = React.useState<boolean>(false);
	return (
		<View className="gap-3">
			<View className="flex-row items-center gap-2">
				<Button label="Button" variant="outline" size="sm" onPress={ignorePress} />
				<Toggle label="Toggle" variant="outline" size="sm" pressed={text} onChange={setText} />
			</View>
			<View className="flex-row items-center gap-2">
				<Button label="Bold" variant="outline" icon={BoldIcon} onPress={ignorePress} />
				<Toggle label="Bold" icon={BoldIcon} hideLabel variant="outline" pressed={icon} onChange={setIcon} />
			</View>
		</View>
	);
}
