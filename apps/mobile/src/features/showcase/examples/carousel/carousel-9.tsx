import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";
import { View } from "react-native";

import { carouselSampleSlides, SlidePhoto } from "./carousel-sample";
import { ThumbnailStrip } from "./carousel-thumbnails";

const SLIDES = carouselSampleSlides(10);

// A main slide above a free-scrolling strip of ten thumbnails: the shown one is outlined and a press jumps to it.
export function Carousel9Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<View className="w-full gap-3">
			<Carousel index={index} onChange={setIndex} showIndicators={false}>
				{SLIDES.map((slide): React.JSX.Element => (
					<AspectRatio key={slide.id} ratio={4 / 3} className="overflow-hidden rounded-xl bg-muted">
						<SlidePhoto slide={slide} width={800} height={600} />
					</AspectRatio>
				))}
			</Carousel>
			<ThumbnailStrip slides={SLIDES} index={index} onSelect={setIndex} />
		</View>
	);
}
