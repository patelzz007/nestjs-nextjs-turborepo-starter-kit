import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

export function Separator1Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<View className="gap-1">
				<Text className="text-label font-sans-medium text-foreground">Design System</Text>
				<Text className="text-caption font-sans text-muted-foreground">The Foundation for your UI.</Text>
			</View>
			<Separator />
			<Text className="text-label font-sans text-muted-foreground">A set of beautifully designed components that you can customize, extend, and build on.</Text>
		</View>
	);
}
