import type { ImageSize } from "@workspace/shared";
import { ImageResizer } from "@workspace/ui-native/components/image-resizer";
import * as React from "react";
import { Text, View } from "react-native";

const PHOTO_URL = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";
/** The photo's starting size, in points (16:9). */
const START_SIZE: ImageSize = { width: 240, height: 135 };
const MAX_WIDTH = 320;
const WIDE_RATIO = 16 / 9;

// Drag a corner to size the picture (the ratio is kept); screen readers step it. Its size is reported back.
export function ImageResizer1Example(): React.JSX.Element {
	const [size, setSize] = React.useState<ImageSize>(START_SIZE);
	return (
		<View className="w-full gap-2">
			<ImageResizer uri={PHOTO_URL} alt="A laptop on a desk" value={size} onChange={setSize} maxWidth={MAX_WIDTH} aspectRatio={WIDE_RATIO} />
			<Text className="text-label font-sans text-muted-foreground">{`${String(Math.round(size.width))} × ${String(Math.round(size.height))} pt`}</Text>
		</View>
	);
}
