import * as React from "react";
import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui/components/image-carousel";

function photo(id: string): string {
	return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;
}

const IMAGES: readonly ImageCarouselImage[] = [
	{ id: "workspace", src: photo("photo-1486312338219-ce68d2c6f44d"), alt: "A laptop on a desk" },
	{ id: "code", src: photo("photo-1461749280684-dccba630e2f6"), alt: "Code on a screen" },
	{ id: "network", src: photo("photo-1451187580459-43490279c0fa"), alt: "The earth at night" },
];

export function ImageCarouselDo1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-sm">
			<ImageCarousel images={IMAGES} frameClassName="rounded-lg" />
		</div>
	);
}
