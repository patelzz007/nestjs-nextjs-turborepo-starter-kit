import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

// Square photos with soft corners, the rounding growing with the size, beside a round one.
export function Avatar4Example(): React.JSX.Element {
	return (
		<View className="flex-row items-end gap-3">
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} shape="rounded" size="md" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} shape="rounded" size="lg" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} shape="rounded" size="xl" />
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} size="lg" />
		</View>
	);
}
