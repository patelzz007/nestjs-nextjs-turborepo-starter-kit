import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

/** A tall photo squeezed into a cinematic strip: most of it is cut off. */
export function AspectRatioDont1Example(): React.JSX.Element {
	return <FramedPhoto ratio={21 / 9} photo={SAMPLE_PHOTOS.marble} alt="A portrait photo cropped to a 21:9 strip" />;
}
