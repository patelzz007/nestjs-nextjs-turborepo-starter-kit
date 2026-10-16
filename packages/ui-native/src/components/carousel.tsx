// Slides side by side, one per page (the web kit's `Carousel`): a horizontal
// paging ScrollView with a row of page dots under it — and, with
// `showControls`, previous / next buttons either side of the dots (the web
// kit's arrows). Controlled: the caller owns which slide shows (`index`) and
// hears every change (`onChange`), from a swipe, a dot or an arrow. Each dot is
// a button named by `slideLabel` ("Slide 2 of 5"), and the current one is
// announced as selected.
//
//   ┌──────────────────────────┐
//   │          slide           │   swipe left / right
//   └──────────────────────────┘
//          ‹  ━━ • • •  ›            dots: the current one a pill; arrows on request

import { cva, type VariantProps } from "class-variance-authority";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { Pressable, ScrollView, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { cn } from "../lib/cn";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { IconButton } from "./icon-button";

export const carouselVariants = cva("w-full", {
	variants: {
		/** `plain`: slides straight on the page. `card`: slides inside a bordered card surface. */
		variant: {
			plain: "",
			card: "overflow-hidden rounded-xl border border-border bg-card pb-1",
		},
		/** The page dots' size, and the space above them. */
		size: {
			sm: "gap-1",
			md: "gap-2",
		},
	},
	defaultVariants: { variant: "plain", size: "md" },
});

export const carouselDotVariants = cva("rounded-full", {
	variants: {
		size: {
			sm: "h-1.5",
			md: "h-2",
		},
		selected: {
			true: "bg-primary",
			false: "bg-border",
		},
	},
	compoundVariants: [
		{ size: "sm", selected: false, className: "w-1.5" },
		{ size: "sm", selected: true, className: "w-4" },
		{ size: "md", selected: false, className: "w-2" },
		{ size: "md", selected: true, className: "w-6" },
	],
	defaultVariants: { size: "md", selected: false },
});

type CarouselVariantProps = VariantProps<typeof carouselVariants>;
export type CarouselVariant = NonNullable<CarouselVariantProps["variant"]>;
export type CarouselSize = NonNullable<CarouselVariantProps["size"]>;

/** A slide's position counts from one for people ("Slide 1 of 5"); indexes count from zero. */
const POSITION_OFFSET = 1;
const FIRST_INDEX = 0;

/** The default accessible names of the arrows (the web kit's `previousSlide` / `nextSlide`); generic and overridable. */
export const DEFAULT_CAROUSEL_PREVIOUS_LABEL = "Previous slide";
export const DEFAULT_CAROUSEL_NEXT_LABEL = "Next slide";

/** The slide `index` is clamped to: within the slides, and the first one when there are none. */
export function clampCarouselIndex(index: number, total: number): number {
	return Math.min(Math.max(index, FIRST_INDEX), Math.max(total - POSITION_OFFSET, FIRST_INDEX));
}

/** The default accessible name of a slide's dot; generic and overridable. */
export function defaultCarouselSlideLabel(position: number, total: number): string {
	return `Slide ${String(position)} of ${String(total)}`;
}

export interface CarouselProps {
	/** The slides, one per page. */
	readonly children: React.ReactNode;
	/** The slide that shows (zero-based). */
	readonly index: number;
	/** A swipe or a dot asked for another slide (zero-based). */
	readonly onChange: (index: number) => void;
	/** Names a slide for screen readers: `(2, 5)` → "Slide 2 of 5". */
	readonly slideLabel?: ((position: number, total: number) => string) | undefined;
	/** Hide the dots when the slides carry their own position (a counter in each slide). */
	readonly showIndicators?: boolean | undefined;
	/** Show previous / next buttons either side of the dots (each disabled at its end). */
	readonly showControls?: boolean | undefined;
	/** The arrows' accessible names. */
	readonly previousLabel?: string | undefined;
	readonly nextLabel?: string | undefined;
	readonly variant?: CarouselVariant | undefined;
	readonly size?: CarouselSize | undefined;
	/** Extra classes for the container, merged last (layout: `mt-4`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Carousel = React.memo(
	React.forwardRef<View, CarouselProps>(function Carousel(
		{
			children,
			index,
			onChange,
			slideLabel = defaultCarouselSlideLabel,
			showIndicators = true,
			showControls = false,
			previousLabel = DEFAULT_CAROUSEL_PREVIOUS_LABEL,
			nextLabel = DEFAULT_CAROUSEL_NEXT_LABEL,
			variant = "plain",
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const reduceMotion = useReduceMotion();
		const scrollRef = React.useRef<ScrollView>(null);
		// Display state only: the page width, measured once the carousel is laid out.
		const [pageWidth, setPageWidth] = React.useState(FIRST_INDEX);
		const slides = React.Children.toArray(children);
		const total = slides.length;
		const pageStyle = React.useMemo((): { readonly width: number } => ({ width: pageWidth }), [pageWidth]);

		const measure = React.useCallback((event: LayoutChangeEvent): void => {
			setPageWidth(event.nativeEvent.layout.width);
		}, []);

		// The caller moved `index` (a dot, or its own control): bring that page into view.
		React.useEffect((): void => {
			if (pageWidth > FIRST_INDEX) {
				scrollRef.current?.scrollTo({ x: index * pageWidth, animated: !reduceMotion });
			}
		}, [index, pageWidth, reduceMotion]);

		const settle = React.useCallback(
			(event: NativeSyntheticEvent<NativeScrollEvent>): void => {
				if (pageWidth <= FIRST_INDEX) {
					return;
				}
				const page = clampCarouselIndex(Math.round(event.nativeEvent.contentOffset.x / pageWidth), total);
				if (page !== index) {
					onChange(page);
				}
			},
			[index, onChange, pageWidth, total],
		);

		const showPrevious = React.useCallback((): void => {
			onChange(clampCarouselIndex(index - POSITION_OFFSET, total));
		}, [index, onChange, total]);
		const showNext = React.useCallback((): void => {
			onChange(clampCarouselIndex(index + POSITION_OFFSET, total));
		}, [index, onChange, total]);

		return (
			<View ref={ref} testID={testID} onLayout={measure} className={cn(carouselVariants({ variant, size }), className)}>
				<ScrollView
					ref={scrollRef}
					horizontal
					pagingEnabled
					showsHorizontalScrollIndicator={false}
					onMomentumScrollEnd={settle}
					testID={testID === undefined ? undefined : `${testID}-pager`}>
					{slides.map((slide: React.ReactNode, slideIndex: number): React.JSX.Element => (
						<View
							// Children.toArray gives every slide a stable key; the position is its fallback.
							key={React.isValidElement(slide) && slide.key !== null ? slide.key : slideIndex}
							style={pageStyle}
							accessibilityElementsHidden={slideIndex !== index}
							importantForAccessibility={slideIndex === index ? "auto" : "no-hide-descendants"}>
							{slide}
						</View>
					))}
				</ScrollView>
				{showIndicators || showControls ? (
					<View className="flex-row items-center justify-center gap-2">
						{showControls ? (
							<IconButton
								icon={ChevronLeftIcon}
								label={previousLabel}
								onPress={showPrevious}
								disabled={index <= FIRST_INDEX}
								variant="ghost"
								size="sm"
								{...(testID === undefined ? {} : { testID: `${testID}-previous` })}
							/>
						) : null}
						{showIndicators ? (
							<View className="flex-row items-center justify-center">
								{slides.map((slide: React.ReactNode, slideIndex: number): React.JSX.Element => (
									<CarouselDot
										key={React.isValidElement(slide) && slide.key !== null ? slide.key : slideIndex}
										slideIndex={slideIndex}
										selected={slideIndex === index}
										label={slideLabel(slideIndex + POSITION_OFFSET, total)}
										size={size}
										onSelect={onChange}
									/>
								))}
							</View>
						) : null}
						{showControls ? (
							<IconButton
								icon={ChevronRightIcon}
								label={nextLabel}
								onPress={showNext}
								disabled={index >= total - POSITION_OFFSET}
								variant="ghost"
								size="sm"
								{...(testID === undefined ? {} : { testID: `${testID}-next` })}
							/>
						) : null}
					</View>
				) : null}
			</View>
		);
	}),
);

interface CarouselDotProps {
	readonly slideIndex: number;
	readonly selected: boolean;
	readonly label: string;
	readonly size: CarouselSize;
	readonly onSelect: (index: number) => void;
}

/** One page dot: a 44 pt tall button around the visible dot (rules/04). */
const CarouselDot = React.memo(function CarouselDot({ slideIndex, selected, label, size, onSelect }: CarouselDotProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ selected }), [selected]);
	const select = React.useCallback((): void => {
		onSelect(slideIndex);
	}, [onSelect, slideIndex]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={accessibilityState}
			onPress={select}
			className="min-h-11 min-w-6 items-center justify-center px-1">
			<View className={carouselDotVariants({ size, selected })} />
		</Pressable>
	);
});
