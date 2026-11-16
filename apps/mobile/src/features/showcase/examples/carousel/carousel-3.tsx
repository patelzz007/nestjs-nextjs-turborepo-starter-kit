import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";

import { carouselSampleSlides, SquareSlide } from "./carousel-sample";

const SLIDES = carouselSampleSlides(6);

// Three square photos in view at once, aligned to the start.
export function Carousel3Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} perView={3} gap={8} showControls>
			{SLIDES.map((slide): React.JSX.Element => (
				<SquareSlide key={slide.id} slide={slide} />
			))}
		</Carousel>
	);
}
