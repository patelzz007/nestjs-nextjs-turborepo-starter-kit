import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";
import { View } from "react-native";

export function Switch11Example(): React.JSX.Element {
	const [blue, setBlue] = React.useState<boolean>(true);
	const [green, setGreen] = React.useState<boolean>(true);
	const [yellow, setYellow] = React.useState<boolean>(true);
	return (
		<View className="gap-2">
			<Switch label="Blue" tone="blue" checked={blue} onChange={setBlue} />
			<Switch label="Green" tone="green" checked={green} onChange={setGreen} />
			<Switch label="Yellow" tone="yellow" checked={yellow} onChange={setYellow} />
		</View>
	);
}
