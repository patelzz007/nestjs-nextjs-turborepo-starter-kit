// What the Carousel examples share: the web examples' sample slides (the same Unsplash photos, in the same order),
// a slide's photo, and a numbered square slide.

import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import * as React from "react";
import { Image, Text, View } from "react-native";

const SAMPLE_PHOTO_IDS: readonly string[] = [
	"photo-1486312338219-ce68d2c6f44d",
	"photo-1461749280684-dccba630e2f6",
	"photo-1451187580459-43490279c0fa",
	"photo-1504384308090-c894fdcc538d",
	"photo-1541701494587-cb58502866ab",
	"photo-1579546929518-9e396f3cc809",
	"photo-1618005182384-a83a8bd57fbe",
	"photo-1620121692029-d088224ddc74",
	"photo-1620641788421-7a1c342ea42e",
	"photo-1607990281513-2c110a25bd8c",
];

export interface CarouselSampleSlide {
	readonly id: string;
	/** One-based, as people count ("Slide 3"). */
	readonly number: number;
	readonly photoId: string;
}

/** The first `count` sample slides. */
export function carouselSampleSlides(count: number): readonly CarouselSampleSlide[] {
	return SAMPLE_PHOTO_IDS.slice(0, count).map((photoId: string, index: number): CarouselSampleSlide => ({ id: `slide-${String(index + 1)}`, number: index + 1, photoId }));
}

const PHOTO_QUALITY = 80;

export function samplePhotoUrl(slide: CarouselSampleSlide, width: number, height: number): string {
	return `https://images.unsplash.com/${slide.photoId}?auto=format&fit=crop&w=${String(width)}&h=${String(height)}&q=${String(PHOTO_QUALITY)}`;
}

/** A slide's photo filling its frame. */
export function SlidePhoto({
	slide,
	width,
	height,
	prefix = "Slide",
}: {
	readonly slide: CarouselSampleSlide;
	readonly width: number;
	readonly height: number;
	readonly prefix?: string;
}): React.JSX.Element {
	const source = React.useMemo(() => ({ uri: samplePhotoUrl(slide, width, height) }), [height, slide, width]);
	return <Image source={source} accessibilityLabel={`${prefix} ${String(slide.number)}`} resizeMode="cover" className="size-full" />;
}

/** A square photo slide in a rounded frame. */
export function SquareSlide({ slide }: { readonly slide: CarouselSampleSlide }): React.JSX.Element {
	return (
		<AspectRatio ratio={1} className="overflow-hidden rounded-xl bg-muted">
			<SlidePhoto slide={slide} width={600} height={600} />
		</AspectRatio>
	);
}

/** A card slide with its number, for carousels of content rather than photos. */
export function NumberSlide({ slide }: { readonly slide: CarouselSampleSlide }): React.JSX.Element {
	return (
		<View className="size-full items-center justify-center rounded-xl border border-border bg-card">
			<Text className="text-h2 font-heading text-foreground">{slide.number}</Text>
		</View>
	);
}
