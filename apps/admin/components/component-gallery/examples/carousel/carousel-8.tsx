import { Card } from "@workspace/ui/components/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel";
import type * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

/** Slides in this example. */
const SLIDE_COUNT = 5;
/** Photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 1000;
const PHOTO_HEIGHT_PX = 800;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);

export function Carousel8Example(): React.JSX.Element {
	return (
		<Carousel className="w-full max-w-md">
			<CarouselContent>
				{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
					<CarouselItem key={slide.id}>
						<div className="p-1">
							<Card className="group/card relative aspect-video overflow-hidden border-0 p-0">
								<CarouselSlidePhoto
									slide={slide}
									widthPx={PHOTO_WIDTH_PX}
									heightPx={PHOTO_HEIGHT_PX}
									className="absolute inset-0 size-full scale-100 transition-transform duration-500 ease-in-out group-hover/card:scale-105"
								/>
								{/* Background fade effects */}
								<div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-scrim/80 to-transparent" />

								{/* Content */}
								<div className="relative flex h-full flex-col justify-end p-6">
									<h3 className="text-xl font-bold text-status-foreground">Slide {slide.number}</h3>
									<p className="text-sm text-status-foreground/90">Beautiful landscape description for slide {slide.number}.</p>
								</div>
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
