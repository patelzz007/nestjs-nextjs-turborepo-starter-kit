import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { Badge } from "@workspace/ui-native/components/badge";
import { Text, View } from "react-native";

import { FIRST } from "./avatar-sample";

// A photo beside a name with a small Pro badge, and a job title under it.
export function Avatar16Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-3">
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="row" />
			<View className="gap-0.5">
				<View className="flex-row items-center gap-1.5">
					<Text className="text-body font-sans-medium text-foreground">{FIRST.name}</Text>
					<Badge label="Pro" size="sm" variant="light" tone="primary" />
				</View>
				<Text className="text-caption font-sans text-muted-foreground">Product designer</Text>
			</View>
		</View>
	);
}
