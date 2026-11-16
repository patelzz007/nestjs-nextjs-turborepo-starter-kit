import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

export function AspectRatioDo2Example(): React.JSX.Element {
	return <FramedPhoto ratio={9 / 16} photo={SAMPLE_PHOTOS.fluid} alt="A story frame kept narrow" narrow />;
}
