import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";
import { View } from "react-native";

import { CardScrim } from "../card/card-sample";
import { carouselSampleSlides, SlidePhoto } from "./carousel-sample";
import { ThumbnailStrip } from "./carousel-thumbnails";

const SLIDES = carouselSampleSlides(6);

// Thumbnails laid over the bottom of a 16:9 slide on a dark fade, the shown one outlined in white.
export function Carousel10Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<View className="w-full overflow-hidden rounded-xl">
			<Carousel index={index} onChange={setIndex} showIndicators={false}>
				{SLIDES.map((slide): React.JSX.Element => (
					<AspectRatio key={slide.id} ratio={16 / 9} className="bg-muted">
						<SlidePhoto slide={slide} width={800} height={450} />
					</AspectRatio>
				))}
			</Carousel>
			<CardScrim edge="bottom" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
			<View className="absolute inset-x-0 bottom-2">
				<ThumbnailStrip slides={SLIDES} index={index} onSelect={setIndex} tone="light" />
			</View>
		</View>
	);
}
