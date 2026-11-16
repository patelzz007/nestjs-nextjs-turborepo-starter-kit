import type { ImageSize } from "@workspace/shared";
import { ImageResizer } from "@workspace/ui-native/components/image-resizer";
import * as React from "react";

const PHOTO = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";

export function ImageResizerDo2Example(): React.JSX.Element {
	const [size, setSize] = React.useState<ImageSize>({ width: 200, height: 113 });
	return <ImageResizer uri={PHOTO} alt="A laptop on a desk" value={size} onChange={setSize} aspectRatio={16 / 9} minWidth={120} maxWidth={320} />;
}
