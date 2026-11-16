import { Button } from "@workspace/ui-native/components/button";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";
import * as React from "react";

const CONTENT = (
	<View className="gap-1">
		<Text className="text-body-lg font-sans-semibold text-foreground">Next.js</Text>
		<Text className="text-body font-sans text-muted-foreground">The React framework, by Vercel.</Text>
	</View>
);

export function HoverCard1Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Next.js">
			<Button label="@nextjs" variant="outline" onPress={ignorePress} />
		</HoverCard>
	);
}
