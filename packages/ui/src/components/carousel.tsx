"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { CarouselLabels } from "@workspace/ui/lib/navigation/labels";
import type { EmblaCarouselType, EmblaOptionsType, EmblaPluginType } from "embla-carousel";
import useEmblaCarousel, { type EmblaViewportRefType } from "embla-carousel-react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";

type CarouselApi = EmblaCarouselType | undefined;
type CarouselOptions = EmblaOptionsType;
type CarouselPlugin = EmblaPluginType[];

interface CarouselProps {
	readonly opts?: CarouselOptions | undefined;
	readonly plugins?: CarouselPlugin | undefined;
	readonly orientation?: "horizontal" | "vertical" | undefined;
	readonly setApi?: ((api: CarouselApi) => void) | undefined;
	/** Per-usage overrides of the `carousel` family's copy (role descriptions, arrow buttons) from `UiKitLabelsProvider`. */
	readonly labels?: UiKitLabelsOverride<"carousel"> | undefined;
}

interface CarouselContextProps {
	readonly carouselRef: EmblaViewportRefType;
	readonly api: CarouselApi;
	readonly opts: CarouselOptions | undefined;
	readonly orientation: "horizontal" | "vertical";
	readonly labels: CarouselLabels;
	readonly scrollPrev: () => void;
	readonly scrollNext: () => void;
	readonly canScrollPrev: boolean;
	readonly canScrollNext: boolean;
}

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

function useCarousel(): CarouselContextProps {
	const context = React.useContext(CarouselContext);

	if (!context) {
		throw new Error("useCarousel must be used within a <Carousel />");
	}

	return context;
}

const Carousel = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & CarouselProps>(function Carousel(
	{ orientation = "horizontal", opts, setApi, plugins, labels: labelsOverride, className, children, onKeyDownCapture, ...props },
	ref,
): React.JSX.Element {
	const labels = useUiKitLabels("carousel", labelsOverride);
	const emblaOptions = React.useMemo<CarouselOptions>(() => ({ ...opts, axis: orientation === "horizontal" ? "x" : "y" }), [opts, orientation]);
	const [carouselRef, api] = useEmblaCarousel(emblaOptions, plugins);
	const [canScrollPrev, setCanScrollPrev] = React.useState(false);
	const [canScrollNext, setCanScrollNext] = React.useState(false);

	const onSelect = React.useCallback((selectedApi: CarouselApi): void => {
		if (!selectedApi) return;
		setCanScrollPrev(selectedApi.canScrollPrev());
		setCanScrollNext(selectedApi.canScrollNext());
	}, []);

	const scrollPrev = React.useCallback((): void => {
		api?.scrollPrev();
	}, [api]);

	const scrollNext = React.useCallback((): void => {
		api?.scrollNext();
	}, [api]);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLDivElement>): void => {
			onKeyDownCapture?.(event);
			if (event.key === "ArrowLeft") {
				event.preventDefault();
				scrollPrev();
			} else if (event.key === "ArrowRight") {
				event.preventDefault();
				scrollNext();
			}
		},
		[onKeyDownCapture, scrollPrev, scrollNext],
	);

	React.useEffect(() => {
		if (!api || !setApi) return;
		const timeoutId = window.setTimeout(() => {
			setApi(api);
		}, 0);
		return (): void => {
			window.clearTimeout(timeoutId);
		};
	}, [api, setApi]);

	React.useEffect(() => {
		if (!api) return;
		const timeoutId = window.setTimeout(() => {
			onSelect(api);
		}, 0);
		api.on("reInit", onSelect);
		api.on("select", onSelect);

		return (): void => {
			window.clearTimeout(timeoutId);
			api.off("reInit", onSelect);
			api.off("select", onSelect);
		};
	}, [api, onSelect]);

	const contextValue = React.useMemo<CarouselContextProps>(
		() => ({ carouselRef, api, opts, orientation, labels, scrollPrev, scrollNext, canScrollPrev, canScrollNext }),
		[carouselRef, api, opts, orientation, labels, scrollPrev, scrollNext, canScrollPrev, canScrollNext],
	);

	return (
		<CarouselContext.Provider value={contextValue}>
			<div
				ref={ref}
				onKeyDownCapture={handleKeyDown}
				className={cn("relative", className)}
				role="region"
				aria-roledescription={labels.carouselRoleDescription}
				data-slot="carousel"
				{...props}>
				{children}
			</div>
		</CarouselContext.Provider>
	);
});

/** The scrolling track. The ref reaches the track; Embla owns the viewport around it. */
const CarouselContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CarouselContent({ className, ...props }, ref): React.JSX.Element {
	const { carouselRef, orientation } = useCarousel();

	return (
		<div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
			<div ref={ref} className={cn("flex", orientation === "horizontal" ? "-ms-4" : "-mt-4 flex-col", className)} {...props} />
		</div>
	);
});

const CarouselItem = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function CarouselItem({ className, ...props }, ref): React.JSX.Element {
	const { orientation, labels } = useCarousel();

	return (
		<div
			ref={ref}
			role="group"
			aria-roledescription={labels.slideRoleDescription}
			data-slot="carousel-item"
			className={cn("min-w-0 shrink-0 grow-0 basis-full", orientation === "horizontal" ? "ps-4" : "pt-4", className)}
			{...props}
		/>
	);
});

interface CarouselArrowProps extends React.ComponentProps<typeof Button> {
	/** Screen-reader text. @default the Carousel's `labels.previousSlide` / `labels.nextSlide` */
	readonly label?: string;
}

const CarouselPrevious = React.forwardRef<HTMLElement, CarouselArrowProps>(function CarouselPrevious(
	{ className, variant = "outline", size = "icon-sm", label, onClick, ...props },
	ref,
): React.JSX.Element {
	const { orientation, scrollPrev, canScrollPrev, labels } = useCarousel();
	const handleClick = React.useCallback<NonNullable<CarouselArrowProps["onClick"]>>(
		(event): void => {
			onClick?.(event);
			scrollPrev();
		},
		[onClick, scrollPrev],
	);

	return (
		<Button
			ref={ref}
			data-slot="carousel-previous"
			variant={variant}
			size={size}
			className={cn(
				"absolute touch-manipulation rounded-full",
				orientation === "horizontal" ? "inset-y-0 -inset-s-12 my-auto" : "inset-s-1/2 -top-12 -translate-x-1/2 rotate-90 rtl:translate-x-1/2",
				className,
			)}
			disabled={!canScrollPrev}
			onClick={handleClick}
			{...props}>
			<ChevronLeftIcon className="rtl:rotate-180" />
			<span className="sr-only">{label ?? labels.previousSlide}</span>
		</Button>
	);
});

const CarouselNext = React.forwardRef<HTMLElement, CarouselArrowProps>(function CarouselNext(
	{ className, variant = "outline", size = "icon-sm", label, onClick, ...props },
	ref,
): React.JSX.Element {
	const { orientation, scrollNext, canScrollNext, labels } = useCarousel();
	const handleClick = React.useCallback<NonNullable<CarouselArrowProps["onClick"]>>(
		(event): void => {
			onClick?.(event);
			scrollNext();
		},
		[onClick, scrollNext],
	);

	return (
		<Button
			ref={ref}
			data-slot="carousel-next"
			variant={variant}
			size={size}
			className={cn(
				"absolute touch-manipulation rounded-full",
				orientation === "horizontal" ? "inset-y-0 -inset-e-12 my-auto" : "inset-s-1/2 -bottom-12 -translate-x-1/2 rotate-90 rtl:translate-x-1/2",
				className,
			)}
			disabled={!canScrollNext}
			onClick={handleClick}
			{...props}>
			<ChevronRightIcon className="rtl:rotate-180" />
			<span className="sr-only">{label ?? labels.nextSlide}</span>
		</Button>
	);
});

export { type CarouselApi, type CarouselLabels, Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext, useCarousel };
