import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";

import { carouselSampleSlides, SquareSlide } from "./carousel-sample";

const SLIDES = carouselSampleSlides(6);

// A pair of square photos in view with the gutter cut to 4 points.
export function Carousel7Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} perView={2} gap={4}>
			{SLIDES.map((slide): React.JSX.Element => (
				<SquareSlide key={slide.id} slide={slide} />
			))}
		</Carousel>
	);
}
