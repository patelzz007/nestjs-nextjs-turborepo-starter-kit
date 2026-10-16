"use client";

import { Carousel, CarouselContent, CarouselItem } from "@workspace/ui/components/carousel";
import type * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";
import { CarouselThumbnail, useThumbnailCarouselSync } from "@/components/component-gallery/examples/carousel/carousel-thumbnail-sync";

/** Slides in this example. */
const SLIDE_COUNT = 10;
/** Main photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 1200;
const PHOTO_HEIGHT_PX = 675;
/** Thumbnail photo size requested from the CDN, in pixels (square). */
const THUMB_SIZE_PX = 200;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);

/** Embla options, as the kit Carousel's `opts` prop takes them. */
type CarouselOptions = NonNullable<React.ComponentProps<typeof Carousel>["opts"]>;

const THUMB_STRIP_OPTIONS: CarouselOptions = { containScroll: "keepSnaps", dragFree: true };

export function Carousel10Example(): React.JSX.Element {
	const { setMainApi, setThumbApi, selectedIndex, selectSlide } = useThumbnailCarouselSync();

	return (
		<div className="flex w-full max-w-2xl items-center justify-center p-4">
			<div className="group relative w-full overflow-hidden rounded-xl">
				{/* Main Carousel */}
				<Carousel setApi={setMainApi} className="w-full">
					<CarouselContent>
						{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
							<CarouselItem key={slide.id}>
								<div className="relative aspect-video w-full overflow-hidden bg-muted">
									<CarouselSlidePhoto slide={slide} widthPx={PHOTO_WIDTH_PX} heightPx={PHOTO_HEIGHT_PX} />
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
				</Carousel>

				{/* Overlay Thumbnails Container */}
				<div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-scrim/60 to-transparent p-4 transition-opacity duration-300">
					<div className="relative mx-auto w-full max-w-md">
						<Carousel setApi={setThumbApi} opts={THUMB_STRIP_OPTIONS} className="w-full">
							<CarouselContent className="-ml-2 flex-row">
								{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
									<CarouselThumbnail
										key={slide.id}
										slide={slide}
										isSelected={slide.index === selectedIndex}
										onSelect={selectSlide}
										photoSizePx={THUMB_SIZE_PX}
										itemClassName="basis-1/4 pl-2 sm:basis-1/8"
										frameClassName="rounded-md transition-all duration-300"
										selectedClassName="border-status-foreground opacity-100 ring-2 ring-scrim/20"
										idleClassName="border-status-foreground/40 opacity-50 hover:opacity-80"
									/>
								))}
							</CarouselContent>
						</Carousel>
					</div>
				</div>
			</div>
		</div>
	);
}
