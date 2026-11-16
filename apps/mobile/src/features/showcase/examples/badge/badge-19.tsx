import { View } from "react-native";
import { Badge } from "@workspace/ui-native/components/badge";
import * as React from "react";

export function Badge19Example(): React.JSX.Element {
	return (
		<View className="flex-row flex-wrap items-center gap-2">
			<Badge label="8" size="sm" tone="primary" variant="solid" />
			<Badge label="New" tone="primary" variant="solid" />
			<Badge label="99+" size="lg" tone="primary" variant="solid" />
			<Badge label="Outline" variant="outline" />
			<Badge label="Secondary" />
			<Badge label="Live" tone="success" variant="light" />
		</View>
	);
}
