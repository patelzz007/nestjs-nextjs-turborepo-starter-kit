import { View } from "react-native";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

export function BadgeDont1Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			<Badge label="Paid" tone="destructive" variant="solid" />
			<Badge label="Overdue" tone="success" variant="solid" />
		</View>
	);
}
