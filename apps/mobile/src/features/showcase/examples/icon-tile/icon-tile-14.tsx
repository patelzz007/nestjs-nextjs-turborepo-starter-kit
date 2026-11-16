import { IconTile } from "@workspace/ui-native/components/icon-tile";
import GlobeIcon from "lucide-react-native/icons/globe";
import * as React from "react";
import { View } from "react-native";

// A status dot on the top-end corner, cut out by a ring in the screen's colour.
const ONLINE = <View className="size-3 rounded-full border-2 border-background bg-success" />;

export function IconTile14Example(): React.JSX.Element {
	return <IconTile icon={GlobeIcon} variant="elevated" tone="brand" badge={ONLINE} className="self-center" />;
}
