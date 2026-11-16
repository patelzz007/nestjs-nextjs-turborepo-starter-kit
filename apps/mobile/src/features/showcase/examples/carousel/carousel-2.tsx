import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";

import { carouselSampleSlides, NumberSlide } from "./carousel-sample";

const SLIDES = carouselSampleSlides(5);

// Cards stacked in a fixed-height column that scrolls up and down, the next one peeking.
export function Carousel2Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} orientation="vertical" peek={60} showControls className="h-80">
			{SLIDES.map((slide): React.JSX.Element => (
				<NumberSlide key={slide.id} slide={slide} />
			))}
		</Carousel>
	);
}
