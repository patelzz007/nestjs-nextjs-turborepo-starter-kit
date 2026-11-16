import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

export function AspectRatioDo1Example(): React.JSX.Element {
	return <FramedPhoto ratio={4 / 5} photo={SAMPLE_PHOTOS.marble} alt="A portrait post in a 4:5 frame" narrow />;
}
