"use client";

import * as React from "react";
import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui/components/image-carousel";

function photo(photoId: string): string {
	return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`;
}

const IMAGES: readonly ImageCarouselImage[] = [
	{ id: "workspace", src: photo("photo-1486312338219-ce68d2c6f44d"), alt: "A laptop on a desk" },
	{ id: "code", src: photo("photo-1461749280684-dccba630e2f6"), alt: "Code on a screen" },
	{ id: "network", src: photo("photo-1451187580459-43490279c0fa"), alt: "The earth at night" },
];

export function ImageCarousel1Example(): React.JSX.Element {
	const [selectedIndex, setSelectedIndex] = React.useState<number>(0);

	return (
		<div className="mx-auto flex w-full max-w-lg flex-col gap-2">
			<ImageCarousel images={IMAGES} onSelectedIndexChange={setSelectedIndex} frameClassName="rounded-lg" />
			<p className="text-sm text-muted-foreground">
				Photo {selectedIndex + 1} of {IMAGES.length}
			</p>
		</div>
	);
}
