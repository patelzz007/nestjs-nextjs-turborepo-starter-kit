"use client";

import * as React from "react";
import { ImageResizer } from "@workspace/ui/components/image-resizer";
import type { ImageSize } from "@workspace/shared";

const PHOTO_URL = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=800&q=80";
/** The photo's starting size, in CSS pixels (16 : 9). */
const START_SIZE: ImageSize = { width: 384, height: 216 };
const MAX_WIDTH_PX = 640;
const WIDE_RATIO = 16 / 9;

export function ImageResizer1Example(): React.JSX.Element {
	const [size, setSize] = React.useState<ImageSize>(START_SIZE);

	return (
		<div className="flex flex-col gap-2 p-4">
			<ImageResizer src={PHOTO_URL} alt="A laptop on a desk" value={size} onValueChange={setSize} maxWidth={MAX_WIDTH_PX} aspectRatio={WIDE_RATIO} className="rounded-lg" />
			<p className="text-sm text-muted-foreground">
				{size.width} × {size.height} px
			</p>
		</div>
	);
}
