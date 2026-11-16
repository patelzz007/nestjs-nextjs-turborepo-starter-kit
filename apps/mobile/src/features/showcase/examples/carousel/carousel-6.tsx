import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";
import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";

import { carouselSampleSlides, SlidePhoto } from "./carousel-sample";

const SLIDES = carouselSampleSlides(5);

// A looping row of 16:9 slides, the shown one centred so both neighbours peek in at the edges.
export function Carousel6Example(): React.JSX.Element {
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} peek={36} align="center" loop>
			{SLIDES.map((slide): React.JSX.Element => (
				<AspectRatio key={slide.id} ratio={16 / 9} className="overflow-hidden rounded-xl bg-muted">
					<SlidePhoto slide={slide} width={800} height={450} />
				</AspectRatio>
			))}
		</Carousel>
	);
}
