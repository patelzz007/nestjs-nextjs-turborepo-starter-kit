import { Card } from "@workspace/ui/components/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";
import type * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

/** Slides in this example. */
const SLIDE_COUNT = 5;
/** Photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 600;
const PHOTO_HEIGHT_PX = 600;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);

export function Carousel7Example(): React.JSX.Element {
	return (
		<Carousel className="w-full max-w-xs">
			<CarouselContent className="-ml-1">
				{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
					<CarouselItem key={slide.id} className="basis-1/2 pl-1">
						<div className="p-1">
							<Card className="relative aspect-square overflow-hidden border-0 p-0">
								<CarouselSlidePhoto slide={slide} widthPx={PHOTO_WIDTH_PX} heightPx={PHOTO_HEIGHT_PX} />
							</Card>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious />
			<CarouselNext />
		</Carousel>
	);
}
