import Image from "next/image";
import * as React from "react";

import { SCROLL_PHOTO_HEIGHT, SCROLL_PHOTO_WIDTH, SCROLL_PHOTOS, type ScrollPhoto } from "@/components/component-gallery/examples/scroll-area/scroll-area-sample";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";

export function ScrollArea2Example(): React.JSX.Element {
	return (
		<ScrollArea className="h-auto max-w-96 rounded-2xl border">
			<div className="flex w-max gap-4 p-4">
				{SCROLL_PHOTOS.map((photo: ScrollPhoto): React.JSX.Element => (
					<div key={photo.id} className="relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl border">
						<Image src={photo.src} alt={photo.alt} width={SCROLL_PHOTO_WIDTH} height={SCROLL_PHOTO_HEIGHT} className="h-full w-full object-cover" />
					</div>
				))}
			</div>
			<ScrollBar orientation="horizontal" />
		</ScrollArea>
	);
}
