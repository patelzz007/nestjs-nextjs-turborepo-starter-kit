import { Rating } from "@workspace/ui-native/components/rating";
import * as React from "react";
import { Text, View } from "react-native";

export function Rating4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(0);
	return (
		<View className="gap-2">
			<Rating value={value} onChange={setValue} accessibilityLabel="Your rating" size="lg" />
			<Text className="text-body font-sans text-muted-foreground">{value === 0 ? "Tap a star to rate." : `Thanks: you gave ${String(value)} of 5.`}</Text>
		</View>
	);
}
