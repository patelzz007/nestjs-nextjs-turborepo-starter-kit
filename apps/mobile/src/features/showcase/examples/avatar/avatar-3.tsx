import { Avatar, type AvatarSize } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

const SIZES: readonly AvatarSize[] = ["sm", "md", "row", "lg"];

// The built-in sizes side by side: small, medium, a list row's and large.
export function Avatar3Example(): React.JSX.Element {
	return (
		<View className="flex-row items-end gap-3">
			{SIZES.map((size: AvatarSize): React.JSX.Element => (
				<Avatar key={size} name={FIRST.name} imageUrl={FIRST.photo} size={size} />
			))}
		</View>
	);
}
