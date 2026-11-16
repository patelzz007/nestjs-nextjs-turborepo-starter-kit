import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

export function UserAvatarDont1Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Avatar name="Ada Lovelace" imageUrl={null} size="md" />
			<Avatar name="Alan Turing" imageUrl={null} size="md" />
		</View>
	);
}
