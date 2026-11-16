import { IconTile } from "@workspace/ui-native/components/icon-tile";
import * as React from "react";
import { View } from "react-native";

export function IconTile9Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-3">
			<IconTile text="AK" variant="elevated" tone="brand" />
			<IconTile text="12" variant="outline" radius="full" />
		</View>
	);
}
