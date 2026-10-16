"use client";

import { Carousel, CarouselContent, CarouselItem } from "@workspace/ui/components/carousel";
import type * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";
import { CarouselThumbnail, useThumbnailCarouselSync } from "@/components/component-gallery/examples/carousel/carousel-thumbnail-sync";

/** Slides in this example. */
const SLIDE_COUNT = 10;
/** Main photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 1000;
const PHOTO_HEIGHT_PX = 800;
/** Thumbnail photo size requested from the CDN, in pixels (square). */
const THUMB_SIZE_PX = 400;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);

/** Embla options, as the kit Carousel's `opts` prop takes them. */
type CarouselOptions = NonNullable<React.ComponentProps<typeof Carousel>["opts"]>;

const THUMB_STRIP_OPTIONS: CarouselOptions = { containScroll: "keepSnaps", dragFree: true };

export function Carousel9Example(): React.JSX.Element {
	const { setMainApi, setThumbApi, selectedIndex, selectSlide } = useThumbnailCarouselSync();

	return (
		<div className="flex w-full max-w-md flex-col gap-3 p-4">
			<Carousel setApi={setMainApi} className="w-full">
				<CarouselContent>
					{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
						<CarouselItem key={slide.id}>
							<div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
								<CarouselSlidePhoto slide={slide} widthPx={PHOTO_WIDTH_PX} heightPx={PHOTO_HEIGHT_PX} />
							</div>
						</CarouselItem>
					))}
				</CarouselContent>
			</Carousel>

			<Carousel setApi={setThumbApi} opts={THUMB_STRIP_OPTIONS} className="w-full">
				<CarouselContent className="-ml-2 flex-row">
					{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
						<CarouselThumbnail
							key={slide.id}
							slide={slide}
							isSelected={slide.index === selectedIndex}
							onSelect={selectSlide}
							photoSizePx={THUMB_SIZE_PX}
							itemClassName="basis-1/5 pl-2 sm:basis-1/6"
							frameClassName="rounded-lg transition-all"
							selectedClassName="border-primary opacity-100"
							idleClassName="border-transparent opacity-40 hover:opacity-70"
						/>
					))}
				</CarouselContent>
			</Carousel>
		</div>
	);
}
