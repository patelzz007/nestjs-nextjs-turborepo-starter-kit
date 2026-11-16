import { IconTile } from "@workspace/ui-native/components/icon-tile";
import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import ClockIcon from "lucide-react-native/icons/clock";
import StarIcon from "lucide-react-native/icons/star";
import * as React from "react";
import { View } from "react-native";

// Status tiles: the default `tint` paints each tone's soft fill with its glyph colour.

export function IconTile8Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-3">
			<IconTile icon={StarIcon} tone="brand" />
			<IconTile icon={CircleCheckIcon} tone="green" />
			<IconTile icon={ClockIcon} tone="yellow" />
			<IconTile icon={CircleAlertIcon} tone="red" />
		</View>
	);
}
