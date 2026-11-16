import { Rating } from "@workspace/ui-native/components/rating";
import * as React from "react";
import { View } from "react-native";

export function Rating5Example(): React.JSX.Element {
	return (
		<View className="gap-3">
			<Rating value={4} size="sm" />
			<Rating value={4} />
			<Rating value={4} size="lg" />
		</View>
	);
}
