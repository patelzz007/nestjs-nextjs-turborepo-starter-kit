import { View } from "react-native";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

export function BadgeDo1Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			<Badge label="Paid" tone="success" variant="light" />
			<Badge label="Overdue" tone="destructive" variant="light" />
		</View>
	);
}
