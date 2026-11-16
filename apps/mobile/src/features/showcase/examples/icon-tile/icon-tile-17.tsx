import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { IconTile, type IconTileTone } from "@workspace/ui-native/components/icon-tile";
import CircleAlertIcon from "lucide-react-native/icons/circle-alert";
import MessageSquareIcon from "lucide-react-native/icons/message-square";
import Settings2Icon from "lucide-react-native/icons/settings-2";
import StarIcon from "lucide-react-native/icons/star";
import * as React from "react";
import { View } from "react-native";

// Solid tiles that keep the elevated look: the tone's fill, with the chip's ring and shadow layered on.
interface ElevatedSolidTile {
	readonly tone: IconTileTone;
	readonly icon: LucideIcon;
}

const ELEVATED_RING = "border-2 border-background shadow-sm";

const TILES: readonly ElevatedSolidTile[] = [
	{ tone: "violet", icon: StarIcon },
	{ tone: "orange", icon: MessageSquareIcon },
	{ tone: "green", icon: Settings2Icon },
	{ tone: "red", icon: CircleAlertIcon },
];

export function IconTile17Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			{TILES.map((tile: ElevatedSolidTile): React.JSX.Element => (
				<IconTile key={tile.tone} icon={tile.icon} variant="solid" tone={tile.tone} className={ELEVATED_RING} />
			))}
		</View>
	);
}
