import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

export function EntityAvatarDo1Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Avatar name="Acme Coffee" imageUrl={null} shape="rounded" tone="name" />
			<Avatar name="Acme Coffee" imageUrl={null} shape="rounded" tone="name" size="md" />
		</View>
	);
}
