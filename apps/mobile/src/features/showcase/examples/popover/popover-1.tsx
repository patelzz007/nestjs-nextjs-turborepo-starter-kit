import { Button } from "@workspace/ui-native/components/button";
import { Popover } from "@workspace/ui-native/components/popover";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import * as React from "react";

const CONTENT = (
	<View className="gap-1">
		<Text className="text-body-lg font-sans-semibold text-foreground">Dimensions</Text>
		<Text className="text-body font-sans text-muted-foreground">Set the dimensions for the layer.</Text>
	</View>
);

export function Popover1Example(): React.JSX.Element {
	return (
		<Popover content={CONTENT} accessibilityLabel="Dimensions">
			<Button label="Open popover" variant="outline" onPress={ignorePress} />
		</Popover>
	);
}
