import * as React from "react";
import type { ImageSize } from "@workspace/shared";
import { ImageResizer } from "@workspace/ui/components/image-resizer";

const PHOTO_URL = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";
const START_SIZE: ImageSize = { width: 320, height: 180 };
const WIDE_RATIO = 16 / 9;
const HUGE_WIDTH_PX = 4_000;

export function ImageResizerDont2Example(): React.JSX.Element {
	const [size, setSize] = React.useState<ImageSize>(START_SIZE);
	return (
		<ImageResizer src={PHOTO_URL} alt="A laptop on a desk" value={size} onValueChange={setSize} aspectRatio={WIDE_RATIO} maxWidth={HUGE_WIDTH_PX} className="rounded-lg" />
	);
}
