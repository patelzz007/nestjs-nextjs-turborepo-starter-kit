import { Avatar } from "@workspace/ui-native/components/avatar";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

const RICH = (
	<View className="flex-row items-center gap-2">
		<Avatar name="Ben Ortiz" imageUrl={null} size="sm" />
		<View className="gap-0.5">
			<Text className="text-caption font-sans-semibold text-background">Ben Ortiz</Text>
			<Text className="text-caption font-sans text-background">Online now</Text>
		</View>
	</View>
);

export function Tooltip13Example(): React.JSX.Element {
	return (
		<Tooltip content="Ben Ortiz, online now" richContent={RICH} accessibilityLabel="Ben Ortiz" className="self-start">
			<View>
				<Avatar name="Ben Ortiz" imageUrl={null} size="md" />
				<View className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background bg-success" />
			</View>
		</Tooltip>
	);
}
