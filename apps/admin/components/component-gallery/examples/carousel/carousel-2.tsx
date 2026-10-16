import { Card } from "@workspace/ui/components/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";
import type * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

/** Slides in this example. */
const SLIDE_COUNT = 5;
/** Photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 600;
const PHOTO_HEIGHT_PX = 300;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);
/** Embla options, as the kit Carousel's `opts` prop takes them. */
type CarouselOptions = NonNullable<React.ComponentProps<typeof Carousel>["opts"]>;

const CAROUSEL_OPTIONS: CarouselOptions = { align: "start" };

export function Carousel2Example(): React.JSX.Element {
	return (
		<div className="flex w-full items-center justify-center p-6">
			<Carousel opts={CAROUSEL_OPTIONS} orientation="vertical" className="w-full max-w-xs">
				<CarouselContent className="-mt-1 h-[325px]">
					{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
						<CarouselItem key={slide.id} className="basis-1/2 pt-1">
							<div className="p-1">
								<Card className="relative h-[145px] overflow-hidden border-0 p-0">
									<CarouselSlidePhoto slide={slide} widthPx={PHOTO_WIDTH_PX} heightPx={PHOTO_HEIGHT_PX} />
								</Card>
							</div>
						</CarouselItem>
					))}
				</CarouselContent>
				<CarouselPrevious />
				<CarouselNext />
			</Carousel>
		</div>
	);
}
