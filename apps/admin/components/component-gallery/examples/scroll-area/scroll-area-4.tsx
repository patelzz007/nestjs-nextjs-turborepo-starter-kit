import Image from "next/image";
import * as React from "react";

import { SCROLL_PHOTO_HEIGHT, SCROLL_PHOTO_WIDTH, SCROLL_PHOTOS, type ScrollPhoto } from "@/components/component-gallery/examples/scroll-area/scroll-area-sample";
import { cn } from "@workspace/ui/lib/core/utils";
import { ScrollArea } from "@workspace/ui/components/scroll-area";

export function ScrollArea4Example(): React.JSX.Element {
	return (
		<ScrollArea
			className={cn(
				"h-72 w-48 rounded-2xl border",
				"**:data-[slot=scroll-area-thumb]:rounded-full **:data-[slot=scroll-area-thumb]:bg-foreground/15",
				"**:data-[slot=scroll-area-viewport]:mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))]",
				"**:data-[slot=scroll-area-viewport]:mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))]",
				"**:data-[slot=scroll-area-viewport]:mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))]",
				"**:data-[slot=scroll-area-viewport]:mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))]",
				"**:data-[slot=scroll-area-viewport]:[--fade-size:1.5rem]",
			)}>
			<div className="flex w-max flex-col gap-4 p-4">
				{SCROLL_PHOTOS.map((photo: ScrollPhoto): React.JSX.Element => (
					<div key={photo.id} className="relative h-36 w-40 shrink-0 overflow-hidden rounded-2xl border">
						<Image src={photo.src} alt={photo.alt} width={SCROLL_PHOTO_WIDTH} height={SCROLL_PHOTO_HEIGHT} className="h-full w-full object-cover" />
					</div>
				))}
			</div>
		</ScrollArea>
	);
}
