import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Text, View } from "react-native";

export function UserAvatarDo1Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<Avatar name="Ada Lovelace" imageUrl={null} size="md" />
			<Text className="text-body font-sans-medium text-foreground">Ada Lovelace</Text>
		</View>
	);
}
