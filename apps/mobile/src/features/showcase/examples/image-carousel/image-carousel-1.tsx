import { ImageCarousel, type ImageCarouselImage } from "@workspace/ui-native/components/image-carousel";
import * as React from "react";
import { Text, View } from "react-native";

function photo(photoId: string): string {
	return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=800&q=80`;
}

const IMAGES: readonly ImageCarouselImage[] = [
	{ id: "workspace", uri: photo("photo-1486312338219-ce68d2c6f44d"), alt: "A laptop on a desk" },
	{ id: "code", uri: photo("photo-1461749280684-dccba630e2f6"), alt: "Code on a screen" },
	{ id: "network", uri: photo("photo-1451187580459-43490279c0fa"), alt: "The earth at night" },
];

// A swipeable gallery with arrows and a counter; the shown photo is reported back.
export function ImageCarousel1Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<View className="w-full gap-2">
			<ImageCarousel images={IMAGES} index={index} onChange={setIndex} showCounter />
			<Text className="text-label font-sans text-muted-foreground">{`Photo ${String(index + 1)} of ${String(IMAGES.length)}`}</Text>
		</View>
	);
}
