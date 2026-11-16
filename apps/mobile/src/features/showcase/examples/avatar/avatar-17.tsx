import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

// An inactive member's photo shown muted, beside an active one. (A phone image has no greyscale filter: the muted look stands in for it.)
export function Avatar17Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-4">
			<Avatar name={FIRST.name} imageUrl={FIRST.photo} />
			<View className="opacity-50">
				<Avatar name={FIRST.name} imageUrl={FIRST.photo} accessibilityLabel={`${FIRST.name}, inactive`} />
			</View>
		</View>
	);
}
