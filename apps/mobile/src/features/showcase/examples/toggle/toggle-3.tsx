import { Toggle } from "@workspace/ui-native/components/toggle";
import * as React from "react";
import { View } from "react-native";

export function Toggle3Example(): React.JSX.Element {
	const [small, setSmall] = React.useState<boolean>(false);
	const [medium, setMedium] = React.useState<boolean>(false);
	const [large, setLarge] = React.useState<boolean>(false);
	return (
		<View className="flex-row items-center gap-2">
			<Toggle label="Small" variant="outline" size="sm" pressed={small} onChange={setSmall} />
			<Toggle label="Default" variant="outline" pressed={medium} onChange={setMedium} />
			<Toggle label="Large" variant="outline" size="lg" pressed={large} onChange={setLarge} />
		</View>
	);
}
