import { Separator } from "@workspace/ui-native/components/separator";
import * as React from "react";
import { Text, View } from "react-native";

export function SeparatorDo2Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<View className="flex-row justify-between">
				<Text className="text-label font-sans text-muted-foreground">Subtotal</Text>
				<Text className="text-label font-sans text-foreground">$49.00</Text>
			</View>
			<Separator />
			<View className="flex-row justify-between">
				<Text className="text-label font-sans-medium text-foreground">Total</Text>
				<Text className="text-label font-sans-medium text-foreground">$47.52</Text>
			</View>
		</View>
	);
}
