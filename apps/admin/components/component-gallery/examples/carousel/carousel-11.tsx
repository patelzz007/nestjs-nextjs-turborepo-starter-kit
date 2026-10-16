"use client";

import { Card } from "@workspace/ui/components/card";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@workspace/ui/components/carousel";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto, carouselSampleSlides } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

/** Slides in this example. */
const SLIDE_COUNT = 5;
/** Photo size requested from the CDN, in pixels. */
const PHOTO_WIDTH_PX = 800;
const PHOTO_HEIGHT_PX = 800;
/** The slide shown before the carousel reports a selection. */
const INITIAL_SLIDE_INDEX = 0;
const SLIDES = carouselSampleSlides(SLIDE_COUNT);

interface SlideDotProps {
	readonly slide: CarouselSampleSlide;
	readonly isActive: boolean;
	readonly onSelect: (index: number) => void;
}

/** One dot of the pager; announces which slide it opens. */
function SlideDot({ slide, isActive, onSelect }: SlideDotProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(slide.index);
	}, [onSelect, slide.index]);

	return (
		<button
			type="button"
			className={cn(
				"h-2 cursor-pointer rounded-full transition-all duration-500 ease-in-out",
				isActive ? "w-4 bg-primary opacity-100" : "w-2 bg-muted-foreground opacity-30 hover:opacity-50",
			)}
			onClick={handleClick}
			aria-label={`Go to slide ${String(slide.number)}`}
			aria-current={isActive}
		/>
	);
}

export function Carousel11Example(): React.JSX.Element {
	const [api, setApi] = React.useState<CarouselApi>();
	const [current, setCurrent] = React.useState(INITIAL_SLIDE_INDEX);

	React.useEffect((): (() => void) | undefined => {
		if (!api) return undefined;
		const handleSelect = (): void => {
			setCurrent(api.selectedScrollSnap());
		};
		api.on("select", handleSelect);
		api.on("reInit", handleSelect);
		return (): void => {
			api.off("select", handleSelect);
			api.off("reInit", handleSelect);
		};
	}, [api]);

	const scrollTo = React.useCallback(
		(index: number): void => {
			api?.scrollTo(index);
		},
		[api],
	);

	return (
		<Carousel setApi={setApi} className="w-full max-w-xs">
			<CarouselContent>
				{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
					<CarouselItem key={slide.id}>
						<div className="p-1">
							<Card className="group/card relative aspect-square overflow-hidden border-0 p-0">
								<CarouselSlidePhoto
									slide={slide}
									widthPx={PHOTO_WIDTH_PX}
									heightPx={PHOTO_HEIGHT_PX}
									className="absolute inset-0 size-full scale-100 transition-transform duration-500 ease-in-out group-hover/card:scale-105"
								/>
								{/* Background fade effects */}
								<div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-scrim/80 to-transparent" />

								{/* Content */}
								<div className="absolute inset-0 top-auto flex flex-col justify-end bg-scrim/20 p-4">
									<h3 className="text-xl font-bold text-status-foreground">Slide {slide.number}</h3>
									<p className="text-sm text-status-foreground/90">Feature description for slide {slide.number}.</p>
								</div>
							</Card>
						</div>
					</CarouselItem>
				))}
			</CarouselContent>

			{/* Dots Navigation */}
			<div className="flex justify-center gap-2 py-3">
				{SLIDES.map((slide: CarouselSampleSlide): React.JSX.Element => (
					<SlideDot key={slide.id} slide={slide} isActive={slide.index === current} onSelect={scrollTo} />
				))}
			</div>
		</Carousel>
	);
}
