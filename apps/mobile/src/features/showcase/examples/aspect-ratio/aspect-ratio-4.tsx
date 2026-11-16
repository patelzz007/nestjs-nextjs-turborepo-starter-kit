import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 21:9: cinematic banners and screen headers.
export function AspectRatio4Example(): React.JSX.Element {
	return <FramedPhoto ratio={21 / 9} photo={SAMPLE_PHOTOS.prism} alt="Abstract sample photo in a 21 frame" />;
}
