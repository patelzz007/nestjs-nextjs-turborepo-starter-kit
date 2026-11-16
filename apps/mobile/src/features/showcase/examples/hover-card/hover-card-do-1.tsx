import { Avatar } from "@workspace/ui-native/components/avatar";
import { HoverCard } from "@workspace/ui-native/components/hover-card";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { ignorePress } from "../example-support";

const CONTENT = (
	<View className="flex-row gap-3">
		<Avatar name="Ava Patel" imageUrl={null} size="lg" />
		<View className="flex-1 gap-1">
			<Text className="text-body-lg font-sans-semibold text-foreground">Ava Patel</Text>
			<Text className="text-body font-sans text-muted-foreground">Design lead · joined March 2024</Text>
		</View>
	</View>
);

export function HoverCardDo1Example(): React.JSX.Element {
	return (
		<HoverCard content={CONTENT} accessibilityLabel="Ava Patel">
			<Pressable accessibilityRole="button" accessibilityLabel="Ava Patel" onPress={ignorePress} className="flex-row items-center gap-2 active:opacity-70">
				<Avatar name="Ava Patel" imageUrl={null} size="sm" />
				<Text className="text-body font-sans-medium text-foreground">@avapatel</Text>
			</Pressable>
		</HoverCard>
	);
}
