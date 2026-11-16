import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";

import { carouselSampleSlides, SquareSlide } from "./carousel-sample";

const SLIDES = carouselSampleSlides(4);

export function CarouselDont1Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} showIndicators={false}>
			{SLIDES.map((slide): React.JSX.Element => (
				<SquareSlide key={slide.id} slide={slide} />
			))}
		</Carousel>
	);
}
