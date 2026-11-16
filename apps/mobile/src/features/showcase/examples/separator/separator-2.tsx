import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

export function Separator2Example(): React.JSX.Element {
	return (
		<View className="h-5 flex-row items-center gap-4 self-center">
			<Text className="text-label font-sans text-foreground">Blog</Text>
			<Separator orientation="vertical" />
			<Text className="text-label font-sans text-foreground">Docs</Text>
			<Separator orientation="vertical" />
			<Text className="text-label font-sans text-foreground">Source</Text>
		</View>
	);
}
