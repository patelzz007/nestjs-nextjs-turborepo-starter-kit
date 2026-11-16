import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 4:5: portrait posts in a social feed.
export function AspectRatio7Example(): React.JSX.Element {
	return <FramedPhoto ratio={4 / 5} photo={SAMPLE_PHOTOS.gradient} alt="Abstract sample photo in a 4 frame" narrow />;
}
