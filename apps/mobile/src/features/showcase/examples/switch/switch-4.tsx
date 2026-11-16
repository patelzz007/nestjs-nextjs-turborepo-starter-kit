import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

export function Switch4Example(): React.JSX.Element {
	const [small, setSmall] = React.useState<boolean>(true);
	const [medium, setMedium] = React.useState<boolean>(true);
	return (
		<View className="gap-2">
			<Switch label="Small" size="sm" checked={small} onChange={setSmall} />
			<Switch label="Default" checked={medium} onChange={setMedium} />
		</View>
	);
}
