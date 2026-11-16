import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

export function EntityAvatarDo2Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Avatar name="Bayview Books" imageUrl={null} shape="rounded" tone="name" />
			<Avatar name="Ada Lovelace" imageUrl={null} />
		</View>
	);
}
