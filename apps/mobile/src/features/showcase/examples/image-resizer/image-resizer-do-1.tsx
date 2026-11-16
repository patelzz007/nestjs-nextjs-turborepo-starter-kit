import type { ImageSize } from "@workspace/shared";
import { ImageResizer } from "@workspace/ui-native/components/image-resizer";
import * as React from "react";

const PHOTO = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";

export function ImageResizerDo1Example(): React.JSX.Element {
	const [size, setSize] = React.useState<ImageSize>({ width: 240, height: 135 });
	return <ImageResizer uri={PHOTO} alt="A laptop on a desk" value={size} onChange={setSize} aspectRatio={16 / 9} maxWidth={320} />;
}
