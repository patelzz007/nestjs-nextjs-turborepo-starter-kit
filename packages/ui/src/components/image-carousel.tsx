"use client";

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@workspace/ui/components/carousel";
import { COVER_IMAGE_DEFAULT_RATIO, CoverImage, type CoverImageSource } from "@workspace/ui/components/cover-image";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

/** One image of a carousel: its default URL, optional renditions for `srcset`, and its `alt`. */
export interface ImageCarouselImage {
	/** Identifies the image across renders (e.g. its file id). */
	readonly id: string;
	readonly src: string;
	readonly sources?: readonly CoverImageSource[] | undefined;
	/** Decorative (`""`) by default — a gallery sits next to the title that names it. */
	readonly alt?: string | undefined;
}

export interface ImageCarouselProps {
	readonly images: readonly ImageCarouselImage[];
	/** Width divided by height of every image frame. */
	readonly ratio?: number | undefined;
	/** `sizes` for the renditions: how wide the carousel is drawn (default: the full viewport width). */
	readonly sizes?: string | undefined;
	/** Loads the first image eagerly — when the carousel is above the fold. */
	readonly priority?: boolean | undefined;
	/** The image shown first (0-based); later changes are ignored — remount (e.g. by `key`) to start elsewhere. */
	readonly startIndex?: number | undefined;
	/** Called with the shown image's index (0-based) whenever it changes. */
	readonly onSelectedIndexChange?: ((index: number) => void) | undefined;
	/** Classes of the image frames (e.g. their corner radius). */
	readonly frameClassName?: string | undefined;
	readonly className?: string | undefined;
	/** Per-usage overrides of the `carousel` family's copy from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"carousel"> | undefined;
}

/** Overlaid controls sit on the image: quiet translucent surfaces that stay legible on any photo. */
const OVERLAY_SURFACE = "border-0 bg-background/80 text-foreground shadow-sm backdrop-blur-sm hover:bg-background";

interface CarouselDotProps {
	readonly index: number;
	readonly isSelected: boolean;
	readonly label: string;
	readonly api: CarouselApi;
}

/** Jumps to one image; the current image's dot is wider and marked `aria-current`. */
function CarouselDot({ index, isSelected, label, api }: CarouselDotProps): React.JSX.Element {
	const handleClick = React.useCallback((): void => {
		api?.scrollTo(index);
	}, [api, index]);
	return (
		<button
			type="button"
			aria-label={label}
			aria-current={isSelected ? "true" : undefined}
			onClick={handleClick}
			className={cn(
				"size-2 rounded-full bg-background/60 shadow-sm transition-[width,background-color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
				isSelected ? "w-5 bg-background" : "hover:bg-background/90",
			)}
		/>
	);
}

/**
 * A swipeable gallery of same-shaped images — one image renders as a plain
 * `CoverImage`; several get previous/next buttons, a position counter and a
 * dot per image (arrow keys move too, from `Carousel`). Every slide is lazy
 * except a priority first one, and each loads the rendition its width needs.
 * Data-agnostic: the caller maps its images to `src`/`sources`.
 */
export function ImageCarousel({
	images,
	ratio = COVER_IMAGE_DEFAULT_RATIO,
	sizes,
	priority = false,
	startIndex = 0,
	onSelectedIndexChange,
	frameClassName,
	className,
	labels: labelsOverride,
}: ImageCarouselProps): React.JSX.Element | null {
	const labels = useUiKitLabels("carousel", labelsOverride);
	const [api, setApi] = React.useState<CarouselApi>(undefined);
	const total = images.length;
	const initialIndex = Math.min(Math.max(startIndex, 0), Math.max(total - 1, 0));
	const [selected, setSelected] = React.useState(initialIndex);
	// Embla reads its options once per init: the start index is fixed for this carousel's lifetime.
	const [options] = React.useState(() => ({ startIndex: initialIndex }));

	React.useEffect((): (() => void) | undefined => {
		if (api === undefined) {
			return undefined;
		}
		const handleSelect = (): void => {
			const index = api.selectedScrollSnap();
			setSelected(index);
			onSelectedIndexChange?.(index);
		};
		api.on("select", handleSelect).on("reInit", handleSelect);
		return (): void => {
			api.off("select", handleSelect).off("reInit", handleSelect);
		};
	}, [api, onSelectedIndexChange]);

	const [first] = images;
	if (first === undefined) {
		return null;
	}
	if (total === 1) {
		return <CoverImage src={first.src} sources={first.sources} sizes={sizes} alt={first.alt} ratio={ratio} priority={priority} className={cn(frameClassName, className)} />;
	}

	return (
		<Carousel setApi={setApi} opts={options} labels={labelsOverride} className={cn("group/gallery", className)} data-slot="image-carousel">
			<CarouselContent className="-ms-0">
				{images.map((image, index) => (
					<CarouselItem key={image.id} className="ps-0" aria-label={labels.slidePosition(index + 1, total)}>
						<CoverImage
							src={image.src}
							sources={image.sources}
							sizes={sizes}
							alt={image.alt}
							ratio={ratio}
							priority={index === initialIndex ? priority : false}
							className={frameClassName}
						/>
					</CarouselItem>
				))}
			</CarouselContent>
			<CarouselPrevious className={cn("start-3 top-1/2 -translate-y-1/2 disabled:opacity-0", OVERLAY_SURFACE)} />
			<CarouselNext className={cn("end-3 top-1/2 -translate-y-1/2 disabled:opacity-0", OVERLAY_SURFACE)} />
			<p aria-hidden="true" className={cn("pointer-events-none absolute end-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums", OVERLAY_SURFACE)}>
				{`${String(selected + 1)} / ${String(total)}`}
			</p>
			<div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" data-slot="image-carousel-dots">
				{images.map((image, index) => (
					<CarouselDot key={image.id} index={index} isSelected={index === selected} label={labels.goToSlide(index + 1)} api={api} />
				))}
			</div>
		</Carousel>
	);
}
