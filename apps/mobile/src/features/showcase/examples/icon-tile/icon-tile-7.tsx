import { IconTile } from "@workspace/ui-native/components/icon-tile";
import ImageIcon from "lucide-react-native/icons/image";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import * as React from "react";
import { View } from "react-native";

// Past the size scale: `size` picks the glyph, `className` the box.

export function IconTile7Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			<IconTile icon={ImageIcon} variant="elevated" tone="brand" size="xl" className="size-16" />
			<IconTile icon={Settings2Icon} variant="elevated" tone="brand" size="xl" className="size-14" />
		</View>
	);
}
