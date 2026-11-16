import { Avatar } from "@workspace/ui-native/components/avatar";
import { Badge } from "@workspace/ui-native/components/badge";
import { Tooltip } from "@workspace/ui-native/components/tooltip";
import * as React from "react";
import { Text, View } from "react-native";

const RICH = (
	<View className="flex-row items-center gap-2">
		<Avatar name="Ava Patel" imageUrl={null} size="sm" />
		<View className="gap-0.5">
			<View className="flex-row items-center gap-1.5">
				<Text className="text-caption font-sans-semibold text-background">Ava Patel</Text>
				<Badge label="Admin" size="sm" />
			</View>
			<Text className="text-caption font-sans text-background">ava@acme.com</Text>
		</View>
	</View>
);

export function Tooltip11Example(): React.JSX.Element {
	return (
		<Tooltip content="Ava Patel, Admin, ava@acme.com" richContent={RICH} accessibilityLabel="Ava Patel" className="self-start">
			<Avatar name="Ava Patel" imageUrl={null} size="md" />
		</Tooltip>
	);
}
