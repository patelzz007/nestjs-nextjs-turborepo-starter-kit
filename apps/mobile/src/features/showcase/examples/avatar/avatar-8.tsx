import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import type { AvatarBadgePosition } from "@workspace/ui-native/components/avatar";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

const CORNERS: readonly AvatarBadgePosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

// Round photos with the dot moved to each of the four corners.
export function Avatar8Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-4">
			{CORNERS.map((position: AvatarBadgePosition): React.JSX.Element => (
				<Avatar key={position} name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Online", position }]} />
			))}
		</View>
	);
}
