import { Checkbox } from "@workspace/ui-native/components/checkbox";
import * as React from "react";
import { View } from "react-native";

export function Checkbox6Example(): React.JSX.Element {
	const [blue, setBlue] = React.useState<boolean>(true);
	const [green, setGreen] = React.useState<boolean>(true);
	const [yellow, setYellow] = React.useState<boolean>(true);
	return (
		<View className="gap-2">
			<Checkbox label="Blue" tone="blue" checked={blue} onChange={setBlue} />
			<Checkbox label="Green" tone="green" checked={green} onChange={setGreen} />
			<Checkbox label="Yellow" tone="yellow" checked={yellow} onChange={setYellow} />
		</View>
	);
}
