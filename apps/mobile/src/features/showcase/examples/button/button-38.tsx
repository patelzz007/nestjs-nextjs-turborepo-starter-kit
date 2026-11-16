import StarIcon from "lucide-react-native/icons/star";
import { Button } from "@workspace/ui-native/components/button";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

export function Button38Example(): React.JSX.Element {
	return (
		<Button
			label="Star"
			variant="outline"
			icon={StarIcon}
			accessibilityLabel="Star, 589 stars"
			trailing={
				<View className="flex-row items-center gap-2">
					<View className="h-4 w-px bg-border" />
					<Text className="text-button font-sans text-muted-foreground tabular-nums">589</Text>
				</View>
			}
			onPress={ignorePress}
		/>
	);
}
