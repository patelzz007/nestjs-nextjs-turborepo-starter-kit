import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

export function EntityAvatarDont1Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-2">
			<Avatar name="Acme Coffee" imageUrl={null} shape="rounded" tone="solid" />
			<Avatar name="Acme Coffee" imageUrl={null} shape="rounded" tone="inverse" size="md" />
		</View>
	);
}
