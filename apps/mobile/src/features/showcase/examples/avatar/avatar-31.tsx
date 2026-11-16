import { Avatar } from "@workspace/ui-native/components/avatar";
import * as React from "react";
import type { AvatarBadgePosition } from "@workspace/ui-native/components/avatar";
import BadgeCheckIcon from "lucide-react-native/icons/badge-check";
import { View } from "react-native";

import { FIRST } from "./avatar-sample";

const CORNERS: readonly AvatarBadgePosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

// A verified rosette at a different corner on each of four photos.
export function Avatar31Example(): React.JSX.Element {
	return (
		<View className="flex-row gap-4">
			{CORNERS.map((position: AvatarBadgePosition): React.JSX.Element => (
				<Avatar key={position} name={FIRST.name} imageUrl={FIRST.photo} badges={[{ label: "Verified", icon: BadgeCheckIcon, color: "info", position }]} />
			))}
		</View>
	);
}
