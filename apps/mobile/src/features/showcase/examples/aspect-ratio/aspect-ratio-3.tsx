import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 1:1: product shots, album covers and grid tiles.
export function AspectRatio3Example(): React.JSX.Element {
	return <FramedPhoto ratio={1} photo={SAMPLE_PHOTOS.fluid} alt="Abstract sample photo in a 1 frame" narrow />;
}
