import { Card } from "@workspace/ui/components/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";
import type * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

/** Slides in this example. */
const SLIDE_COUNT = 5;
/** Photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 400;
const PHOTO_HEIGHT_PX = 400;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);
/** Embla options, as the kit Carousel's `opts` prop takes them. */
type CarouselOptions = NonNullable<React.ComponentProps<typeof Carousel>["opts"]>;

const CAROUSEL_OPTIONS: CarouselOptions = { align: "start" };

export function Carousel3Example(): React.JSX.Element {
	return (
		<Carousel opts={CAROUSEL_OPTIONS} className="w-full max-w-3xl">
			<CarouselContent>
				{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
					<CarouselItem key={slide.id} className="basis-1/3">
						<div className="p-1">
							<Card className="relative aspect-square overflow-hidden border-0 p-0">
								<CarouselSlidePhoto slide={slide} widthPx={PHOTO_WIDTH_PX} heightPx={PHOTO_HEIGHT_PX} />
							</Card>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious className="hidden sm:inline-flex" />
			<CarouselNext className="hidden sm:inline-flex" />
		</Carousel>
	);
}
