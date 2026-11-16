import { Avatar } from "@workspace/ui-native/components/avatar";
import { Button } from "@workspace/ui-native/components/button";
import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { ignorePress } from "../example-support";

const PERSON_CONTENT = (
	<View className="gap-3">
		<View className="flex-row items-center gap-3">
			<Avatar name="Ava Patel" imageUrl={null} size="lg" />
			<View className="flex-1 gap-0.5">
				<Text className="text-body-lg font-sans-semibold text-foreground">Ava Patel</Text>
				<Text className="text-body font-sans text-muted-foreground">@avapatel</Text>
			</View>
		</View>
		<Text className="text-body font-sans text-foreground">Design systems at Acme. Coffee, type and good defaults.</Text>
		<View className="flex-row gap-4">
			<Text className="text-body font-sans text-muted-foreground">1,284 followers</Text>
			<Text className="text-body font-sans text-muted-foreground">312 following</Text>
		</View>
	</View>
);

export function Popover6Example(): React.JSX.Element {
	const content = (
		<View className="gap-3">
			{PERSON_CONTENT}
			<Button label="Follow" size="sm" onPress={ignorePress} />
		</View>
	);
	return (
		<Popover content={content} accessibilityLabel="Ava Patel's profile" size="lg">
			<Pressable accessibilityRole="button" accessibilityLabel="Ava Patel" className="flex-row items-center gap-2 rounded-full border border-border px-2 py-1 active:bg-muted">
				<Avatar name="Ava Patel" imageUrl={null} size="sm" />
				<Text className="text-body font-sans-medium text-foreground">@avapatel</Text>
			</Pressable>
		</Popover>
	);
}
