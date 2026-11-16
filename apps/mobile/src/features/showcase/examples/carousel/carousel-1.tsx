import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";

import { carouselSampleSlides, SquareSlide } from "./carousel-sample";

const SLIDES = carouselSampleSlides(5);

// The minimal carousel: five square photos, one per view, with dots and arrows.
export function Carousel1Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} showControls>
			{SLIDES.map((slide): React.JSX.Element => (
				<SquareSlide key={slide.id} slide={slide} />
			))}
		</Carousel>
	);
}
