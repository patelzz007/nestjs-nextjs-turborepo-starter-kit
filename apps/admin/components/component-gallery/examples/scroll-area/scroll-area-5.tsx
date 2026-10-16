import Image from "next/image";
import * as React from "react";

import { SCROLL_PHOTO_HEIGHT, SCROLL_PHOTO_WIDTH, SCROLL_PHOTOS, type ScrollPhoto } from "@/components/component-gallery/examples/scroll-area/scroll-area-sample";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

export function ScrollArea5Example(): React.JSX.Element {
	return (
		<ScrollArea className="h-72 w-56 rounded-2xl border data-has-overflow-x:py-2.5 data-has-overflow-y:px-2.5">
			<div className="flex w-full flex-col items-center gap-4 py-2">
				{SCROLL_PHOTOS.map((photo: ScrollPhoto): React.JSX.Element => (
					<div key={photo.id} className="relative h-36 w-full shrink-0 overflow-hidden rounded-2xl border">
						<Image src={photo.src} alt={photo.alt} width={SCROLL_PHOTO_WIDTH} height={SCROLL_PHOTO_HEIGHT} className="h-full w-full object-cover" />
					</div>
				))}
			</div>
		</ScrollArea>
	);
}
