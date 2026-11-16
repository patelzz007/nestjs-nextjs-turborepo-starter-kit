import { IconTile } from "@workspace/ui-native/components/icon-tile";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import GlobeIcon from "lucide-react-native/icons/globe";
import StarIcon from "lucide-react-native/icons/star";
import * as React from "react";
import { View } from "react-native";

export function IconTile6Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			<IconTile icon={GlobeIcon} variant="outline" tone="brand" size="lg" radius="full" />
			<IconTile icon={StarIcon} variant="elevated" tone="brand" size="lg" radius="full" />
			<IconTile icon={CircleCheckIcon} variant="frame" tone="brand" size="lg" radius="full" />
		</View>
	);
}
