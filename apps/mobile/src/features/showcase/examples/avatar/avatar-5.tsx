import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

// Sizes beyond the presets: 16, 32, 48 and 64 points.
export function Avatar5Example(): React.JSX.Element {
	return (
		<View className="flex-row items-end gap-3">
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="xs" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="md" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="row" className="size-12" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="xl" />
		</View>
	);
}
