import { Carousel } from "@workspace/ui-native/components/carousel";
import * as React from "react";
import { AspectRatio } from "@workspace/ui-native/components/aspect-ratio";
import { useWindowDimensions } from "react-native";

import { carouselSampleSlides, SlidePhoto } from "./carousel-sample";

const SLIDES = carouselSampleSlides(8);
/** The window width from which two slides show. */
const WIDE = 600;

// Portrait photos whose count in view follows the screen's width: one on a phone, two on a wide phone or tablet.
export function Carousel4Example(): React.JSX.Element {
	const { width } = useWindowDimensions();
	const [index, setIndex] = React.useState(0);
	return (
		<Carousel index={index} onChange={setIndex} perView={width >= WIDE ? 2 : 1} gap={12} showControls>
			{SLIDES.map((slide): React.JSX.Element => (
				<AspectRatio key={slide.id} ratio={3 / 4} className="overflow-hidden rounded-xl bg-muted">
					<SlidePhoto slide={slide} width={600} height={800} />
				</AspectRatio>
			))}
		</Carousel>
	);
}
