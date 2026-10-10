// The first-launch walkthrough (ADR 041): a few full-width pages on the
// theme's own surfaces — page background, card rings, a solid `primary` tile —
// so it is light in light mode and dark in dark mode, like the rest of the app. Built from React Native and Reanimated only: a paging ScrollView
// whose position, tracked on the UI thread, drives each page's parallax and the
// page dots. Presentational and controlled by its slides: the caller supplies
// the pages and what finishing does.
//
//   ▣ Reward Hub                Skip     brand row + skip
//
//            ◯  ◯                        illustration: the slide's mark on the
//         ╭───────╮  ◇                   brand tile, inside soft rings, with two
//         │   ▣   │                      accent chips — drifting slower than
//         ╰───────╯                      the page as it is swiped (parallax)
//
//   Secure by design                     title (Bricolage) + description
//   Two-factor, app lock and …
//
//   ━━━ • •                              page dots — the current one a pill
//   [            Next            ]       primary button; "Get started" last
//
// The page dots and the step count are one element for screen readers
// ("Step 2 of 3"); swiping and the buttons both move between pages.

import * as React from "react";
import { Pressable, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

import { useReduceMotion } from "../lib/use-reduce-motion";
import { BrandMark } from "./brand-mark";
import { Button } from "./button";
import { Icon, type LucideIcon } from "./icon";

/** react-native-safe-area-context's view, with Uniwind's `className` (see screen.tsx). */
const StyledSafeAreaView = withUniwind(SafeAreaView);
/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

/** The illustration drifts at this share of the page's speed: the parallax. */
const ILLUSTRATION_DRIFT = 0.45;
/** The text drifts a little, so it settles after the page. */
const TEXT_DRIFT = 0.15;
/** A neighbouring page's illustration, half a swipe away, is this much smaller. */
const OFFSTAGE_SCALE = 0.82;
const FULL_SCALE = 1;
const HIDDEN = 0;
const VISIBLE = 1;
/** Page dots: resting and current widths, in points. */
const DOT_SIZE = 8;
const ACTIVE_DOT_WIDTH = 24;
const DOT_REST_OPACITY = 0.3;
/** Side of the brand mark in the brand row and on a slide's tile, in points. */
const BRAND_ROW_MARK_SIZE = 20;
const SLIDE_MARK_SIZE = 44;
/** One step to the next page. */
const NEXT_PAGE = 1;
/** The first page; a page's position is its distance from it. */
const FIRST_PAGE = 0;

/** What a slide's tile shows: the brand mark, or a Lucide icon. */
export type OnboardingMark = { readonly kind: "brand" } | { readonly kind: "icon"; readonly icon: LucideIcon };

export interface OnboardingSlide {
	readonly key: string;
	readonly mark: OnboardingMark;
	/** Two small chips around the tile, hinting at what the slide is about. */
	readonly accents: readonly [LucideIcon, LucideIcon];
	readonly title: string;
	readonly description: string;
}

export interface OnboardingLabels {
	readonly skip: string;
	readonly next: string;
	readonly finish: string;
	/** "Step 2 of 3", for screen readers. */
	readonly step: (current: number, total: number) => string;
}

export interface OnboardingCarouselProps {
	readonly brandName: string;
	readonly slides: readonly OnboardingSlide[];
	readonly labels: OnboardingLabels;
	/** Finished or skipped: either way, onboarding is over. */
	readonly onFinish: () => void;
	readonly testID?: string;
}

export function OnboardingCarousel({ brandName, slides, labels, onFinish, testID }: OnboardingCarouselProps): React.JSX.Element {
	const { width } = useWindowDimensions();
	const reduceMotion = useReduceMotion();
	const scrollRef = useAnimatedRef<Animated.ScrollView>();
	const scrollX = useSharedValue(FIRST_PAGE);
	const [page, setPage] = React.useState(FIRST_PAGE);
	const isLastPage = page >= slides.length - NEXT_PAGE;

	const onScroll = useAnimatedScrollHandler((event) => {
		scrollX.set(event.contentOffset.x);
	});
	const settlePage = React.useCallback(
		(event: NativeSyntheticEvent<NativeScrollEvent>): void => {
			setPage(Math.round(event.nativeEvent.contentOffset.x / width));
		},
		[width],
	);
	const goNext = React.useCallback((): void => {
		if (isLastPage) {
			onFinish();
			return;
		}
		const nextPage = page + NEXT_PAGE;
		setPage(nextPage);
		scrollRef.current?.scrollTo({ x: nextPage * width, animated: !reduceMotion });
	}, [isLastPage, onFinish, page, reduceMotion, scrollRef, width]);

	return (
		<StyledSafeAreaView edges={["top", "bottom", "left", "right"]} className="flex-1 bg-background" testID={testID}>
			<View className="h-14 flex-row items-center justify-between px-6">
				<View className="flex-row items-center gap-2.5">
					<View className="size-8 items-center justify-center rounded-lg bg-primary">
						<BrandMark size={BRAND_ROW_MARK_SIZE} colorClassName="accent-primary-foreground" />
					</View>
					<Text className="font-heading text-lg text-foreground">{brandName}</Text>
				</View>
				{isLastPage ? null : (
					<Pressable accessibilityRole="button" accessibilityLabel={labels.skip} onPress={onFinish} hitSlop={8} className="min-h-11 justify-center px-1 active:opacity-60">
						<Text className="font-sans-semibold text-base text-muted-foreground">{labels.skip}</Text>
					</Pressable>
				)}
			</View>
			<Animated.ScrollView
				ref={scrollRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onScroll={onScroll}
				scrollEventThrottle={16}
				onMomentumScrollEnd={settlePage}
				testID={testID === undefined ? undefined : `${testID}-pager`}>
				{slides.map((slide: OnboardingSlide, index: number): React.JSX.Element => (
					<OnboardingPage key={slide.key} slide={slide} index={index} width={width} scrollX={scrollX} />
				))}
			</Animated.ScrollView>
			<View className="gap-7 px-6 pt-4 pb-8">
				<View accessible accessibilityLabel={labels.step(page + NEXT_PAGE, slides.length)} className="flex-row items-center justify-center gap-2">
					{slides.map((slide: OnboardingSlide, index: number): React.JSX.Element => (
						<PageDot key={slide.key} index={index} width={width} scrollX={scrollX} />
					))}
				</View>
				<Button label={isLastPage ? labels.finish : labels.next} onPress={goNext} />
			</View>
		</StyledSafeAreaView>
	);
}

interface PageProps {
	readonly index: number;
	readonly width: number;
	readonly scrollX: SharedValue<number>;
}

interface OnboardingPageProps extends PageProps {
	readonly slide: OnboardingSlide;
}

function OnboardingPage({ slide, index, width, scrollX }: OnboardingPageProps): React.JSX.Element {
	const [firstAccent, secondAccent] = slide.accents;
	const pageStyle = React.useMemo((): { readonly width: number } => ({ width }), [width]);

	const illustrationStyle = useAnimatedStyle(() => {
		const offset = scrollX.get() - index * width;
		return {
			opacity: interpolate(offset, [-width, FIRST_PAGE, width], [HIDDEN, VISIBLE, HIDDEN], Extrapolation.CLAMP),
			transform: [
				{ translateX: offset * ILLUSTRATION_DRIFT },
				{ scale: interpolate(Math.abs(offset), [FIRST_PAGE, width], [FULL_SCALE, OFFSTAGE_SCALE], Extrapolation.CLAMP) },
			],
		};
	});
	const textStyle = useAnimatedStyle(() => {
		const offset = scrollX.get() - index * width;
		return {
			opacity: interpolate(Math.abs(offset), [FIRST_PAGE, width / 2], [VISIBLE, HIDDEN], Extrapolation.CLAMP),
			transform: [{ translateX: offset * TEXT_DRIFT }],
		};
	});

	return (
		<View style={pageStyle} className="flex-1 justify-between gap-8 px-6 pb-4">
			<StyledAnimatedView className="flex-1 items-center justify-center" style={illustrationStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
				<View className="size-64 items-center justify-center rounded-full border border-border">
					<View className="size-44 items-center justify-center rounded-full border border-border bg-card">
						<View className="size-24 items-center justify-center rounded-3xl bg-primary shadow-lg">
							{slide.mark.kind === "brand" ? (
								<BrandMark size={SLIDE_MARK_SIZE} colorClassName="accent-primary-foreground" />
							) : (
								<Icon icon={slide.mark.icon} size="2xl" weight="bold" colorClassName="accent-primary-foreground" />
							)}
						</View>
					</View>
					<View className="absolute top-6 right-4 size-12 rotate-6 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
						<Icon icon={firstAccent} size="md" colorClassName="accent-primary" />
					</View>
					<View className="absolute bottom-8 left-2 size-11 -rotate-6 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
						<Icon icon={secondAccent} size="md" colorClassName="accent-muted-foreground" />
					</View>
				</View>
			</StyledAnimatedView>
			<StyledAnimatedView className="gap-3" style={textStyle}>
				<Text accessibilityRole="header" className="font-heading text-3xl text-foreground">
					{slide.title}
				</Text>
				<Text className="font-sans text-base text-muted-foreground">{slide.description}</Text>
			</StyledAnimatedView>
		</View>
	);
}

function PageDot({ index, width, scrollX }: PageProps): React.JSX.Element {
	const dotStyle = useAnimatedStyle(() => {
		const distance = Math.abs(scrollX.get() / width - index);
		return {
			width: interpolate(distance, [FIRST_PAGE, NEXT_PAGE], [ACTIVE_DOT_WIDTH, DOT_SIZE], Extrapolation.CLAMP),
			opacity: interpolate(distance, [FIRST_PAGE, NEXT_PAGE], [VISIBLE, DOT_REST_OPACITY], Extrapolation.CLAMP),
		};
	});
	return <StyledAnimatedView className="h-2 rounded-full bg-foreground" style={dotStyle} />;
}
