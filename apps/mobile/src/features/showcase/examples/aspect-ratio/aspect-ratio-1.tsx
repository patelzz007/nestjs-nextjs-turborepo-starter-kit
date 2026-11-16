import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 16:9: video players and slide decks, landscape and wide.
export function AspectRatio1Example(): React.JSX.Element {
	return <FramedPhoto ratio={16 / 9} photo={SAMPLE_PHOTOS.gradient} alt="Abstract sample photo in a 16 frame" />;
}
