import { IconTile, type IconTileTone } from "@workspace/ui-native/components/icon-tile";
import StarIcon from "lucide-react-native/icons/star";
import * as React from "react";
import { View } from "react-native";

// `soft`: the tone tints the ring, the inner card and the glyph.
const TONES: readonly IconTileTone[] = ["brand", "blue", "green", "yellow", "red"];

export function IconTile15Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			{TONES.map((tone: IconTileTone): React.JSX.Element => (
				<IconTile key={tone} icon={StarIcon} variant="soft" tone={tone} />
			))}
		</View>
	);
}
