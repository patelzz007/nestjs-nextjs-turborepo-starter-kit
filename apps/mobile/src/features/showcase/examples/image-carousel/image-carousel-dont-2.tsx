import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui-native/components/image-carousel";
import * as React from "react";

function photo(photoId: string): string {
	return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`;
}

const IMAGES: readonly ImageCarouselImage[] = [
	{ id: "a", uri: photo("photo-1451187580459-43490279c0fa"), alt: "Photo" },
	{ id: "b", uri: photo("photo-1486312338219-ce68d2c6f44d"), alt: "Photo" },
];

export function ImageCarouselDont2Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return <ImageCarousel images={IMAGES} index={index} onChange={setIndex} showCounter />;
}
