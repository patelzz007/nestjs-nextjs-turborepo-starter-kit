import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

// A rule under every line, then another inside a bordered box: lines on lines, and nothing reads as a group.
export function SeparatorDont1Example(): React.JSX.Element {
	return (
		<View className="gap-2 rounded-lg border border-border p-3">
			<Text className="text-label font-sans text-foreground">Notifications</Text>
			<Separator />
			<Separator />
			<Text className="text-label font-sans text-foreground">Privacy</Text>
			<Separator />
		</View>
	);
}
