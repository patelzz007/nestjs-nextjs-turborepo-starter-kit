import { Rating } from "@workspace/ui-native/components/rating";
import * as React from "react";
import { Text, View } from "react-native";

export function Rating7Example(): React.JSX.Element {
	const [value, setValue] = React.useState<number>(3.5);
	return (
		<View className="gap-2">
			<Rating value={value} onChange={setValue} allowHalf size="lg" accessibilityLabel="Your rating" />
			<Text className="text-body font-sans text-muted-foreground">{`${String(value)} out of 5`}</Text>
		</View>
	);
}
