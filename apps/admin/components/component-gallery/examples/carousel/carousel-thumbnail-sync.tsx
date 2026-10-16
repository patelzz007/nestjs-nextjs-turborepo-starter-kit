"use client";

import { CarouselItem, type CarouselApi } from "@workspace/ui/components/carousel";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

import { type CarouselSampleSlide, CarouselSlidePhoto } from "@/components/component-gallery/examples/carousel/carousel-sample-slides";

// ── Main carousel + thumbnail strip, kept in step ───────────────────────────
// Shared by the "Thumbnail Strip" and "Overlay Thumbnails" examples: picking a
// thumbnail scrolls the main carousel, and the main carousel's selection
// scrolls the strip and highlights its thumbnail.

/** The slide shown before the main carousel reports a selection. */
const INITIAL_SLIDE_INDEX = 0;

export interface ThumbnailCarouselSync {
	readonly setMainApi: (api: CarouselApi) => void;
	readonly setThumbApi: (api: CarouselApi) => void;
	readonly selectedIndex: number;
	readonly selectSlide: (index: number) => void;
}

export function useThumbnailCarouselSync(): ThumbnailCarouselSync {
	const [mainApi, setMainApi] = React.useState<CarouselApi>();
	const [thumbApi, setThumbApi] = React.useState<CarouselApi>();
	const [selectedIndex, setSelectedIndex] = React.useState(INITIAL_SLIDE_INDEX);

	React.useEffect((): (() => void) | undefined => {
		if (!mainApi) return undefined;
		const handleSelect = (): void => {
			const index = mainApi.selectedScrollSnap();
			setSelectedIndex(index);
			thumbApi?.scrollTo(index);
		};
		mainApi.on("select", handleSelect);
		mainApi.on("reInit", handleSelect);
		return (): void => {
			mainApi.off("select", handleSelect);
			mainApi.off("reInit", handleSelect);
		};
	}, [mainApi, thumbApi]);

	const selectSlide = React.useCallback(
		(index: number): void => {
			mainApi?.scrollTo(index);
		},
		[mainApi],
	);

	return { setMainApi, setThumbApi, selectedIndex, selectSlide };
}

export interface CarouselThumbnailProps {
	readonly slide: CarouselSampleSlide;
	readonly isSelected: boolean;
	readonly onSelect: (index: number) => void;
	/** Photo size requested from the CDN, in pixels (square). */
	readonly photoSizePx: number;
	/** Classes for the strip item (its basis and gutter). */
	readonly itemClassName: string;
	/** Classes for the thumbnail frame. */
	readonly frameClassName: string;
	/** Frame classes added while this thumbnail's slide is shown. */
	readonly selectedClassName: string;
	/** Frame classes while another slide is shown. */
	readonly idleClassName: string;
}

/** One thumbnail in the strip: a button that shows its slide in the main carousel. */
export function CarouselThumbnail({
	slide,
	isSelected,
	onSelect,
	photoSizePx,
	itemClassName,
	frameClassName,
	selectedClassName,
	idleClassName,
}: CarouselThumbnailProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		onSelect(slide.index);
	}, [onSelect, slide.index]);

	return (
		<CarouselItem className={itemClassName}>
			<button
				type="button"
				onClick={handleClick}
				aria-label={`Show slide ${String(slide.number)}`}
				aria-current={isSelected}
				className={cn("relative block aspect-square w-full cursor-pointer overflow-hidden border-2", frameClassName, isSelected ? selectedClassName : idleClassName)}>
				<CarouselSlidePhoto slide={slide} widthPx={photoSizePx} heightPx={photoSizePx} altPrefix="Thumbnail" />
			</button>
		</CarouselItem>
	);
}
