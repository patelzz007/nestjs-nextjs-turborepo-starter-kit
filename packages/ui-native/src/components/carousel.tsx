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
//
// Two options for content carousels (a row of cards on a dashboard):
//   - `peek`: each slide is narrower than the carousel, so the start of the next one shows at the edge
//     (a cue that there is more to swipe); slides sit `gap` apart and snap into place.
//
//       ┌────────────────────┐ ┌───
//       │       slide        │ │ ne…      ← `peek` points of the next slide
//       └────────────────────┘ └───
//
//   - `gap` without a peek: full-width slides that sit `gap` apart while they are swiped (cards whose
//     borders should never touch) and still settle one per page. Without it, pages touch as before.
//
//   - `autoPlayIntervalMs`: moves on to the next slide on its own, back to the first after the last. It
//     stops for good the moment the person takes over (a swipe, a dot or an arrow), and never runs with
//     the OS "Reduce Motion" setting on — moving content must be stoppable (WCAG 2.2.2). The caller turns
//     it off while the screen is out of sight (pass `undefined`).
//
//   - `loop` (always on with auto-play): round and round, both ways. After the last slide the first
//     comes in from the right, sliding left like every other step; before the first, the last comes in
//     from the left — never a rewind back across all the slides. A copy of the last slide sits before
//     the first and a copy of the first after the last; the carousel slides onto a copy, then swaps to
//     the real slide with no animation (the two look the same). Arrows, swipes and auto-play all do so.
//
//       [ 3' ][ 1 ][ 2 ][ 3 ][ 1' ]   3 → 1' slides left, then 1' → 1 in place;
//                                      1 → 3' slides right, then 3' → 3 in place

import { cva, type VariantProps } from "class-variance-authority";
import ChevronLeftIcon from "lucide-react-native/icons/chevron-left";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import {
	type LayoutChangeEvent,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	View,
	type ViewInstance,
} from "react-native";

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
/** No peek: one full-width slide per page. */
const NO_PEEK = 0;
/** Full-width pages touch unless the caller asks for a gap. */
const NO_GAP = 0;
/**
 * How close to a copy counts as on it, as a share of one slide. A swipe settles where the OS snapped it —
 * whole physical pixels, so a few points off the copy's exact offset — and is read as the nearest slide.
 * A wrap the carousel animates swaps in its last few points instead: the swap keeps the picture still.
 */
export const SETTLED_ON_COPY_SHARE = 0.5;
export const SLIDING_ONTO_COPY_SHARE = 0.05;
/** How often a moving pager reports where it is, in milliseconds: every frame, to catch the copy at once. */
const SCROLL_EVENT_THROTTLE_MS = 16;
/** Points between slides when they peek, unless the caller says otherwise. */
export const DEFAULT_CAROUSEL_GAP = 12;

/** The gap the carousel uses: the caller's, else the default between peeking slides, else none (pages touch). */
export function carouselGapOf(peek: number, gap: number | undefined): number {
	return gap ?? (peek > NO_PEEK ? DEFAULT_CAROUSEL_GAP : NO_GAP);
}

/**
 * One slide's width and the distance from one slide's start to the next's, for a carousel `width` wide:
 * a peeking slide leaves room for the peek and the gap; a full-width one is the whole width, `gap` apart.
 */
export function carouselSlideMetrics(width: number, peek: number, gap: number): { readonly slideWidth: number; readonly interval: number } {
	const slideWidth = peek > NO_PEEK ? Math.max(width - peek - gap, NO_PEEK) : width;
	return { slideWidth, interval: slideWidth + gap };
}

/** The slide after `index`, back to the first after the last (auto-play's order). */
export function nextCarouselIndex(index: number, total: number): number {
	return index >= total - POSITION_OFFSET ? FIRST_INDEX : index + POSITION_OFFSET;
}

/** How a step goes round a looping carousel: not at all, past the last slide, or before the first. */
export type CarouselWrap = "none" | "forward" | "backward";

/**
 * Where the pager scrolls to show slide `index`. A looping pager has the last slide's copy in front (`lead`
 * is 1), so every slide sits one place along; while wrapping it goes to a copy instead — the first's after
 * the last (`forward`) or the last's before the first (`backward`) — so the step slides like the others.
 */
export function carouselScrollTarget(index: number, interval: number, total: number, wrap: CarouselWrap, lead: number): number {
	switch (wrap) {
		case "forward":
			return (total + lead) * interval;
		case "backward":
			return FIRST_INDEX;
		case "none":
			return (index + lead) * interval;
	}
}

/**
 * A looping pager on a copy — the first slide's after the last (or past it in a fling), or the last
 * slide's in front — within `share` of a slide, and the real slide it stands for, with the offset that
 * shows exactly the same picture; `null` anywhere else. The two look alike, so the pager swaps in place.
 */
export function carouselLoopJump(offset: number, interval: number, total: number, share: number): { readonly offset: number; readonly index: number } | null {
	if (interval <= FIRST_INDEX) {
		return null;
	}
	const tolerance = interval * share;
	const firstCopyAt = (total + POSITION_OFFSET) * interval;
	if (offset >= firstCopyAt - tolerance) {
		return { offset: offset - total * interval, index: FIRST_INDEX };
	}
	if (offset <= tolerance) {
		return { offset: offset + total * interval, index: total - POSITION_OFFSET };
	}
	return null;
}

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
	/** Points of the next slide that show at the edge (0, the default: one full-width slide per page). */
	readonly peek?: number | undefined;
	/**
	 * Points between slides: 12 by default when they peek; with full-width slides, none unless given
	 * (then each still fills the width when it settles, `gap` apart while swiped).
	 */
	readonly gap?: number | undefined;
	/**
	 * Move on to the next slide every this many milliseconds, wrapping to the first; `undefined` (the
	 * default) never does. Stops for good once the person swipes or taps a dot or arrow; off with Reduce
	 * Motion. Pass `undefined` while the screen is out of sight.
	 */
	readonly autoPlayIntervalMs?: number | undefined;
	/**
	 * Go round, both ways: after the last slide the first slides in from the right, and before the first
	 * the last slides in from the left (both arrows stay on; a swipe past either end goes round). Always
	 * on with `autoPlayIntervalMs`.
	 */
	readonly loop?: boolean | undefined;
	readonly variant?: CarouselVariant | undefined;
	readonly size?: CarouselSize | undefined;
	/** Extra classes for the container, merged last (layout: `mt-4`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Carousel = React.memo(
	React.forwardRef<ViewInstance, CarouselProps>(function Carousel(
		{
			children,
			index,
			onChange,
			slideLabel = defaultCarouselSlideLabel,
			showIndicators = true,
			showControls = false,
			previousLabel = DEFAULT_CAROUSEL_PREVIOUS_LABEL,
			nextLabel = DEFAULT_CAROUSEL_NEXT_LABEL,
			peek = NO_PEEK,
			gap: requestedGap,
			autoPlayIntervalMs,
			loop = false,
			variant = "plain",
			size = "md",
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const reduceMotion = useReduceMotion();
		const scrollRef = React.useRef<ScrollViewInstance>(null);
		// Display state only: the page width, measured once the carousel is laid out.
		const [pageWidth, setPageWidth] = React.useState(FIRST_INDEX);
		// The person swiped or tapped: auto-play stops for good (display state only).
		const [tookOver, setTookOver] = React.useState(false);
		const slides = React.Children.toArray(children);
		const total = slides.length;
		const loops = (loop || autoPlayIntervalMs !== undefined) && total > POSITION_OFFSET;
		const [firstSlide] = slides;
		const lastSlide = slides.at(-POSITION_OFFSET);
		// A looping pager has the last slide's copy in front: every slide sits one place along.
		const lead = loops ? POSITION_OFFSET : FIRST_INDEX;
		// A wrap was asked for: the next index is reached via a copy.
		const wrapAsked = React.useRef<CarouselWrap>("none");
		// The copy the pager is on, or sliding onto; `none` once it swapped to the real slide.
		const onCopy = React.useRef<CarouselWrap>("none");
		// The pager was put in place once: the first placement after layout never animates.
		const placed = React.useRef(false);
		const gap = carouselGapOf(peek, requestedGap);
		// Slides that peek or sit apart snap slide by slide; full-width pages that touch page.
		const snaps = peek > NO_PEEK || gap > NO_GAP;
		const { slideWidth, interval } = carouselSlideMetrics(pageWidth, peek, gap);
		const pageStyle = React.useMemo((): { readonly width: number } => ({ width: slideWidth }), [slideWidth]);
		const trackStyle = React.useMemo((): { readonly gap: number } | undefined => (snaps ? { gap } : undefined), [gap, snaps]);

		const measure = React.useCallback((event: LayoutChangeEvent): void => {
			setPageWidth(event.nativeEvent.layout.width);
		}, []);

		// The caller moved `index` (a dot, or its own control): bring that page into view. Wrapping round,
		// slide on to a copy; without motion there is nothing to see, so go straight to the slide.
		React.useEffect((): void => {
			if (interval <= FIRST_INDEX) {
				return;
			}
			const animated = !reduceMotion && placed.current;
			const wrap: CarouselWrap = animated ? wrapAsked.current : "none";
			wrapAsked.current = "none";
			// Still on a copy (its last scroll report never came): swap first, so this move never rewinds.
			if (onCopy.current !== "none" && wrap === "none") {
				const real = onCopy.current === "forward" ? lead * interval : total * interval;
				scrollRef.current?.scrollTo({ x: real, animated: false });
			}
			onCopy.current = wrap;
			placed.current = true;
			scrollRef.current?.scrollTo({ x: carouselScrollTarget(index, interval, total, wrap, lead), animated });
		}, [index, interval, lead, reduceMotion, total]);

		/** Go round (`loop`): past the last slide to the first, or before the first to the last. */
		const wrapRound = React.useCallback(
			(wrap: Exclude<CarouselWrap, "none">): void => {
				wrapAsked.current = wrap;
				onChange(wrap === "forward" ? FIRST_INDEX : total - POSITION_OFFSET);
			},
			[onChange, total],
		);

		// The pager reached a copy: swap to the real slide in place, and say which one it is.
		const swapOffCopy = React.useCallback(
			(offset: number, share: number): number | null => {
				const jump = loops ? carouselLoopJump(offset, interval, total, share) : null;
				if (jump === null) {
					return null;
				}
				onCopy.current = "none";
				scrollRef.current?.scrollTo({ x: jump.offset, animated: false });
				return jump.index;
			},
			[interval, loops, total],
		);
		const follow = React.useCallback(
			(event: NativeSyntheticEvent<NativeScrollEvent>): void => {
				if (onCopy.current !== "none") {
					swapOffCopy(event.nativeEvent.contentOffset.x, SLIDING_ONTO_COPY_SHARE);
				}
			},
			[swapOffCopy],
		);

		// Auto-play: one timer per slide shown, so a slide always gets the full interval.
		const autoPlays = autoPlayIntervalMs !== undefined && !tookOver && !reduceMotion && total > POSITION_OFFSET;
		React.useEffect((): (() => void) | undefined => {
			if (!autoPlays) {
				return undefined;
			}
			const timer = setTimeout((): void => {
				const next = nextCarouselIndex(index, total);
				if (next === FIRST_INDEX) {
					wrapRound("forward");
				} else {
					onChange(next);
				}
			}, autoPlayIntervalMs);
			return (): void => {
				clearTimeout(timer);
			};
		}, [autoPlayIntervalMs, autoPlays, index, onChange, total, wrapRound]);

		const takeOver = React.useCallback((): void => {
			setTookOver(true);
		}, []);

		const settle = React.useCallback(
			(event: NativeSyntheticEvent<NativeScrollEvent>): void => {
				if (interval <= FIRST_INDEX) {
					return;
				}
				// A swipe past either end settled on a copy: it is the slide it copies.
				const real = swapOffCopy(event.nativeEvent.contentOffset.x, SETTLED_ON_COPY_SHARE);
				if (real !== null) {
					if (real !== index) {
						onChange(real);
					}
					return;
				}
				const page = clampCarouselIndex(Math.round(event.nativeEvent.contentOffset.x / interval) - lead, total);
				if (page !== index) {
					onChange(page);
				}
			},
			[index, interval, lead, onChange, swapOffCopy, total],
		);

		const select = React.useCallback(
			(slideIndex: number): void => {
				setTookOver(true);
				onChange(slideIndex);
			},
			[onChange],
		);
		const showPrevious = React.useCallback((): void => {
			if (loops && index <= FIRST_INDEX) {
				setTookOver(true);
				wrapRound("backward");
				return;
			}
			select(clampCarouselIndex(index - POSITION_OFFSET, total));
		}, [index, loops, select, total, wrapRound]);
		const showNext = React.useCallback((): void => {
			if (loops && index >= total - POSITION_OFFSET) {
				setTookOver(true);
				wrapRound("forward");
				return;
			}
			select(clampCarouselIndex(index + POSITION_OFFSET, total));
		}, [index, loops, select, total, wrapRound]);

		// An arrow stops at its end only when the carousel does not go round.
		const previousOff = !loops && index <= FIRST_INDEX;
		const nextOff = !loops && index >= total - POSITION_OFFSET;

		return (
			<View ref={ref} testID={testID} onLayout={measure} className={cn(carouselVariants({ variant, size }), className)}>
				<ScrollView
					ref={scrollRef}
					horizontal
					showsHorizontalScrollIndicator={false}
					// Full-width pages that touch page; slides that peek or sit apart snap to each slide's start.
					{...(snaps ? { snapToInterval: interval, decelerationRate: "fast", disableIntervalMomentum: true } : { pagingEnabled: true })}
					contentContainerStyle={trackStyle}
					onScrollBeginDrag={takeOver}
					onMomentumScrollEnd={settle}
					onScroll={follow}
					scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
					testID={testID === undefined ? undefined : `${testID}-pager`}>
					{loops ? (
						// The last slide again, for a wrap backwards to slide onto; screen readers never reach it.
						<View
							style={pageStyle}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							testID={testID === undefined ? undefined : `${testID}-loop-copy-last`}>
							{lastSlide}
						</View>
					) : null}
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
					{loops ? (
						// The first slide again, for a wrap forwards to slide onto; screen readers never reach it.
						<View
							style={pageStyle}
							accessibilityElementsHidden
							importantForAccessibility="no-hide-descendants"
							testID={testID === undefined ? undefined : `${testID}-loop-copy-first`}>
							{firstSlide}
						</View>
					) : null}
				</ScrollView>
				{showIndicators || showControls ? (
					<View className="flex-row items-center justify-center gap-2">
						{showControls ? (
							<IconButton
								icon={ChevronLeftIcon}
								label={previousLabel}
								onPress={showPrevious}
								disabled={previousOff}
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
										onSelect={select}
									/>
								))}
							</View>
						) : null}
						{showControls ? (
							<IconButton
								icon={ChevronRightIcon}
								label={nextLabel}
								onPress={showNext}
								disabled={nextOff}
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
