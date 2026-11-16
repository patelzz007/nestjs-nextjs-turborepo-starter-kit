import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

// The caption sits on a patch of the background at the rule's middle.
export function Separator5Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center gap-2">
			<Separator className="flex-1" />
			<Text className="text-caption font-sans text-muted-foreground">or continue with</Text>
			<Separator className="flex-1" />
		</View>
	);
}
