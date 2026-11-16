import * as React from "react";
import { Text, View } from "react-native";

// A hand-drawn rule in a colour of its own: it does not follow the theme.
export function SeparatorDont2Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			<View className="flex-row justify-between">
				<Text className="text-label font-sans text-muted-foreground">Subtotal</Text>
				<Text className="text-label font-sans text-foreground">$49.00</Text>
			</View>
			<View className="h-1 bg-tone-red" />
			<View className="flex-row justify-between">
				<Text className="text-label font-sans-medium text-foreground">Total</Text>
				<Text className="text-label font-sans-medium text-foreground">$47.52</Text>
			</View>
		</View>
	);
}
