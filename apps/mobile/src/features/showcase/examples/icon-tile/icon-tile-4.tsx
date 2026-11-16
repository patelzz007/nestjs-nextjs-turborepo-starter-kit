import { IconTile, type IconTileVariant } from "@workspace/ui-native/components/icon-tile";
import PackageIcon from "lucide-react-native/icons/package";
import * as React from "react";
import { View } from "react-native";

const VARIANTS: readonly IconTileVariant[] = ["outline", "elevated", "soft", "solid", "frame"];

export function IconTile4Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			{VARIANTS.map((variant: IconTileVariant): React.JSX.Element => (
				<IconTile key={variant} icon={PackageIcon} variant={variant} tone="brand" />
			))}
		</View>
	);
}
