import * as React from "react";
import { AspectRatio } from "@workspace/ui/components/aspect-ratio";
import Image from "next/image";

import { SAMPLE_PHOTO_HEIGHT, SAMPLE_PHOTO_WIDTH, SAMPLE_PHOTOS } from "@/components/component-gallery/examples/aspect-ratio/aspect-ratio-sample";

export function AspectRatio7Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<AspectRatio ratio={4 / 5} className="overflow-hidden rounded-xl border bg-muted">
				<Image
					src={SAMPLE_PHOTOS.gradient}
					alt="Abstract sample photo in a 4:5 frame"
					width={SAMPLE_PHOTO_WIDTH}
					height={SAMPLE_PHOTO_HEIGHT}
					className="h-full w-full object-cover"
				/>
			</AspectRatio>
		</div>
	);
}
