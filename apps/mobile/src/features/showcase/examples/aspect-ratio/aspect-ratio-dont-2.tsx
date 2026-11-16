import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

export function AspectRatioDont2Example(): React.JSX.Element {
	return <FramedPhoto ratio={9 / 16} photo={SAMPLE_PHOTOS.fluid} alt="A story frame across the whole width" />;
}
