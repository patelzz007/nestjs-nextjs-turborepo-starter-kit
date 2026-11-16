import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

export function SeparatorDo1Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<Text className="text-label font-sans text-foreground">Notifications</Text>
			<Separator />
			<Text className="text-label font-sans text-foreground">Privacy</Text>
		</View>
	);
}
