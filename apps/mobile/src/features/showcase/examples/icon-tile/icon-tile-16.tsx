import { IconTile, type IconTileTone } from "@workspace/ui-native/components/icon-tile";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import * as React from "react";
import { View } from "react-native";

// `solid`: the tone as a full-strength fill with a contrasting glyph.
const TONES: readonly IconTileTone[] = ["brand", "blue", "green", "yellow", "red"];

export function IconTile16Example(): React.JSX.Element {
	return (
		<View className="flex-row items-center justify-center gap-4">
			{TONES.map((tone: IconTileTone): React.JSX.Element => (
				<IconTile key={tone} icon={CircleCheckIcon} variant="solid" tone={tone} />
			))}
		</View>
	);
}
