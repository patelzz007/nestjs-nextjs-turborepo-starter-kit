import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 16:10: laptop and monitor screens, for app screenshots.
export function AspectRatio8Example(): React.JSX.Element {
	return <FramedPhoto ratio={16 / 10} photo={SAMPLE_PHOTOS.waves} alt="Abstract sample photo in a 16 frame" />;
}
