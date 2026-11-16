import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";

import { carouselSampleSlides, SquareSlide } from "./carousel-sample";

const SLIDES = carouselSampleSlides(5);
const AUTO_PLAY_MS = 2000;

// Photos that move on by themselves every two seconds; a swipe, dot or arrow stops it for good (and Reduce Motion keeps it still).
export function Carousel5Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} autoPlayIntervalMs={AUTO_PLAY_MS} showControls>
			{SLIDES.map((slide): React.JSX.Element => (
				<SquareSlide key={slide.id} slide={slide} />
			))}
		</Carousel>
	);
}
