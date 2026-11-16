import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

export function EntityAvatarDont2Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Avatar name="Bayview Books" imageUrl={null} tone="name" />
			<Avatar name="Ada Lovelace" imageUrl={null} />
		</View>
	);
}
