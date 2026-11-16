import { View } from "react-native";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

export function Badge18Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			<Badge label="Small" size="sm" shape="rounded" />
			<Badge label="Default" shape="rounded" />
			<Badge label="Large" size="lg" shape="rounded" />
		</View>
	);
}
