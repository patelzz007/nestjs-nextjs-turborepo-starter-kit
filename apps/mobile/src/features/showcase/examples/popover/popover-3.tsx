import { Button } from "@workspace/ui-native/components/button";
import { Input } from "@workspace/ui-native/components/input";
import { Label } from "@workspace/ui-native/components/text";
import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Dimensions";
const WIDTH = "Width";
const HEIGHT = "Height";

export function Popover3Example(): React.JSX.Element {
	const [width, setWidth] = React.useState("100%");
	const [height, setHeight] = React.useState("25px");
	const content = (
		<View className="gap-3">
			<Text className="text-body-lg font-sans-semibold text-foreground">{TITLE}</Text>
			<View className="flex-row items-center gap-3">
				<Label className="w-16">{WIDTH}</Label>
				<Input value={width} onChange={setWidth} accessibilityLabel="Width" size="sm" className="flex-1" />
			</View>
			<View className="flex-row items-center gap-3">
				<Label className="w-16">{HEIGHT}</Label>
				<Input value={height} onChange={setHeight} accessibilityLabel="Height" size="sm" className="flex-1" />
			</View>
		</View>
	);
	return (
		<Popover content={content} accessibilityLabel="Dimensions">
			<Button label="Dimensions" variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
