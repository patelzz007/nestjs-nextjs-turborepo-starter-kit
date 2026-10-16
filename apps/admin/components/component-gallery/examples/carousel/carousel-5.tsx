"use client";

import { Card } from "@workspace/ui/components/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@workspace/ui/components/carousel";
import * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

/** Slides in this example. */
const SLIDE_COUNT = 5;
/** Photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 800;
const PHOTO_HEIGHT_PX = 800;
/** How long each slide stays before the carousel advances. */
export const CAROUSEL_AUTOPLAY_DELAY_MS = 2000;
/** Where autoplay wraps back to after the last slide. */
const FIRST_SLIDE_INDEX = 0;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);

/**
 * Advances `api` every `delayMs`, wrapping to the first slide after the last,
 * and stops for good once the person drags the carousel — the same contract
 * as Embla's Autoplay plugin (`stopOnInteraction`), built on the kit's `setApi`.
 */
function useCarouselAutoplay(api: CarouselApi, delayMs: number): void {
	React.useEffect((): (() => void) | undefined => {
		if (!api) return undefined;
		const intervalId = window.setInterval((): void => {
			if (api.canScrollNext()) {
				api.scrollNext();
			} else {
				api.scrollTo(FIRST_SLIDE_INDEX);
			}
		}, delayMs);
		const stop = (): void => {
			window.clearInterval(intervalId);
		};
		api.on("pointerDown", stop);
		return (): void => {
			stop();
			api.off("pointerDown", stop);
		};
	}, [api, delayMs]);
}

export function Carousel5Example(): React.JSX.Element {
	const [api, setApi] = React.useState<CarouselApi>();
	useCarouselAutoplay(api, CAROUSEL_AUTOPLAY_DELAY_MS);

	return (
		<Carousel setApi={setApi} className="w-full max-w-xs">
			<CarouselContent>
				{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
					<CarouselItem key={slide.id}>
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
