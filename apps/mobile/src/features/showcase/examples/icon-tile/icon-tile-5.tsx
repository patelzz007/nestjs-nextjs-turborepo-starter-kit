import { IconTile, type IconTileSize } from "@workspace/ui-native/components/icon-tile";
import PackageIcon from "lucide-react-native/icons/package";
import * as React from "react";
import { View } from "react-native";

const SIZES: readonly IconTileSize[] = ["xs", "sm", "md", "lg", "xl"];

export function IconTile5Example(): React.JSX.Element {
	return (
		<View className="flex-row items-end justify-center gap-4">
			{SIZES.map((size: IconTileSize): React.JSX.Element => (
				<IconTile key={size} icon={PackageIcon} variant="elevated" tone="brand" size={size} />
			))}
		</View>
	);
}
