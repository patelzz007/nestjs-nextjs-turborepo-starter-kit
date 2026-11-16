import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import type { AvatarColor } from "@workspace/ui-native/components/avatar";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

const COLORS: readonly AvatarColor[] = ["primary", "destructive", "violet", "warning"];

// Rings set off from the photo by a background gap, in four colours.
export function Avatar13Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-4">
			{COLORS.map((color: AvatarColor): React.JSX.Element => (
				<Avatar key={color} name={FIRST.name} imageUrl={FIRST.photo} ring={color} size="md" />
			))}
		</View>
	);
}
