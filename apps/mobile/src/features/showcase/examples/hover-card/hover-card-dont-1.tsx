import { Button } from "@workspace/ui-native/components/button";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = (
	<View className="gap-2">
		<Text className="text-body font-sans text-foreground">Delete this project?</Text>
		<Button label="Delete" variant="destructive" size="sm" onPress={ignorePress} />
	</View>
);

export function HoverCardDont1Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Delete project">
			<Button label="Project" variant="outline" onPress={ignorePress} />
		</HoverCard>
	);
}
