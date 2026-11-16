import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 4:3: phone camera photos and classic TV footage.
export function AspectRatio2Example(): React.JSX.Element {
	return <FramedPhoto ratio={4 / 3} photo={SAMPLE_PHOTOS.waves} alt="Abstract sample photo in a 4 frame" />;
}
