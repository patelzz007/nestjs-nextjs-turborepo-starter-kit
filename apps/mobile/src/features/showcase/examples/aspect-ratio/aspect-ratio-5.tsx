import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 9:16: stories and short full-screen vertical video.
export function AspectRatio5Example(): React.JSX.Element {
	return <FramedPhoto ratio={9 / 16} photo={SAMPLE_PHOTOS.marble} alt="Abstract sample photo in a 9 frame" narrow />;
}
