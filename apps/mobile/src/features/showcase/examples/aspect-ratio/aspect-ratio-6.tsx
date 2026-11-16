import * as React from "react";

import { FramedPhoto, SAMPLE_PHOTOS } from "./aspect-ratio-sample";

// 3:2: most DSLR and 35mm photos, for article images.
export function AspectRatio6Example(): React.JSX.Element {
	return <FramedPhoto ratio={3 / 2} photo={SAMPLE_PHOTOS.code} alt="Abstract sample photo in a 3 frame" />;
}
