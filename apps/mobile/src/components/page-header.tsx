// The page header, on the page's own colour like the status bar above it (the app draws edge to
// edge). It has two parts:
//
// - the pinned row — the leading control (the menu, or back) on the left, the app's status (the
//   `trailing` slot: connection and session) and the notifications button on the right and, between
//   them, the page's title. The row never moves.
// - the subtitle line — centred under the title, between the two buttons.
//
// As the page scrolls (`progress` 0 → 1, src/lib/page-header-scroll.tsx) the header shrinks in place:
// its background pulls up from the bottom edge, so the content's curved top stays attached to it, and
// the subtitle stays where it is, fading gently while the rising edge tucks it away. Nothing in the
// header slides with the content: what is left is one slim bar with the menu, the title and
// notifications, exactly where they were.
//
// The bar takes on the content's surface as it collapses: at the top the header is the page's colour
// (`bg-background`) and the content a raised sheet (`bg-card`) under it; collapsed, the content runs
// under the bar, so the bar becomes that same surface, with a hairline (`bg-border`) to mark where
// the content passes beneath — not a darker band over a lighter page, which the dark and Nord themes
// (where the two colours are far apart) made look broken. Both are token-coloured layers whose
// opacity cross-fades (Reanimated cannot interpolate the tokens' `oklch()` colours), so every theme,
// including ones added later, gets it for free.
//
// It is rendered once by the app shell for every signed-in screen — screens never draw their own
// header. Presentational and controlled: the caller gives the title, subtitle, which control leads
// and what each control does. A new `titleKey` brings the new title in from `titleDrift` points away
// while the old one leaves the other way (the page transition's timing), and the leading control
// cross-fades when it changes. All of it follows the OS "Reduce Motion" setting.

import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import BellIcon from "lucide-react-native/icons/bell";
import MenuIcon from "lucide-react-native/icons/menu";
import * as React from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
	Easing,
	Extrapolation,
	FadeIn,
	FadeOut,
	interpolate,
	ReduceMotion,
	useAnimatedStyle,
	withTiming,
	type LayoutAnimation,
	type SharedValue,
} from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { Icon, type LucideIcon } from "@workspace/ui-native/components/icon";
import { CONTROL_SWAP_MS, PAGE_TITLE_TIMING } from "@workspace/ui-native/lib/motion";

const StyledAnimatedView = withUniwind(Animated.View);

/**
 * The header's height below the status bar before it has been measured: the pinned row (`h-14`) and
 * the subtitle line (`text-sm`, `pb-4`). The shell replaces it with the measured height on the first layout.
 */
export const PAGE_HEADER_ESTIMATED_HEIGHT = 92;

/**
 * The pinned row's height below the status bar (`h-14`: keep the two in step). The row never moves,
 * expanded or collapsed, so anything anchored to the header's controls (the toasts) sits under it.
 */
export const PAGE_HEADER_ROW_HEIGHT = 56;

/** Where the header's controls end, in points from the top of the screen: the same expanded or collapsed. */
export function pageHeaderControlsBottom(topInset: number): number {
	return topInset + PAGE_HEADER_ROW_HEIGHT;
}

const HIDDEN = 0;
const VISIBLE = 1;
const AT_REST = 0;
/**
 * How the subtitle fades across the collapse: slowly at first, then away — an ease, not a straight
 * line, so the first few points of a scroll barely touch it. It runs over the whole collapse: the
 * rising background edge clips the line as it goes, so the text never shows over the content.
 */
const SUBTITLE_FADE = Easing.inOut(Easing.quad);

/** The hairline under the collapsed bar appears over the last part of the collapse, as the content reaches it. */
const HAIRLINE_FADE_START = 0.75;
const FULLY_COLLAPSED = 1;

export type PageHeaderLeading = "menu" | "back";

export interface PageHeaderProps {
	/** The page's title, read by screen readers as the page heading. */
	readonly title: string;
	/** One line under the title saying what the page is for. */
	readonly subtitle: string;
	/** Identifies the page: a new key moves the title; the same key with a new title just updates the text. */
	readonly titleKey: string;
	/** Where the incoming title starts, in points: positive from the right, negative from the left. */
	readonly titleDrift: number;
	readonly leading: PageHeaderLeading;
	readonly onMenu: () => void;
	readonly onBack: () => void;
	readonly onNotifications: () => void;
	/** What sits before the notifications button (the app's status pills). */
	readonly trailing?: React.ReactNode;
	/** The status bar's height: the header's colour runs up behind it. */
	readonly topInset: number;
	/** 0 expanded … 1 collapsed, from the page's scroll position. */
	readonly progress: SharedValue<number>;
	/** How far the header collapses: the subtitle line's height. */
	readonly collapseDistance: SharedValue<number>;
	/** Reports the header's full expanded height (status bar included), so screens start their content below it. */
	readonly onHeightChange?: (height: number) => void;
	/** Reports the subtitle line's height: how far the page scrolls while the header collapses. */
	readonly onCollapseDistanceChange?: (distance: number) => void;
	readonly testID?: string;
}

interface TitleSlot {
	readonly key: string;
	readonly title: string;
	readonly subtitle: string;
}

interface TitleSlots {
	readonly current: TitleSlot;
	/** The title leaving after a page change, until the next one replaces it. */
	readonly leaving: TitleSlot | null;
	readonly drift: number;
}

/** The incoming title: from `drift` points away and transparent, to its place. */
function titleEntering(drift: number): () => LayoutAnimation {
	return (): LayoutAnimation => {
		"worklet";
		return {
			initialValues: { opacity: HIDDEN, transform: [{ translateX: drift }] },
			animations: { opacity: withTiming(VISIBLE, PAGE_TITLE_TIMING), transform: [{ translateX: withTiming(AT_REST, PAGE_TITLE_TIMING) }] },
		};
	};
}

/**
 * The outgoing title, mounted afresh as its own element so it leaves in the NEW page's direction
 * (an `exiting` animation would keep the one it was rendered with): from its place to `-drift`, fading out.
 */
function titleLeaving(drift: number): () => LayoutAnimation {
	return (): LayoutAnimation => {
		"worklet";
		return {
			initialValues: { opacity: VISIBLE, transform: [{ translateX: AT_REST }] },
			animations: { opacity: withTiming(HIDDEN, PAGE_TITLE_TIMING), transform: [{ translateX: withTiming(-drift, PAGE_TITLE_TIMING) }] },
		};
	};
}

const CONTROL_IN = FadeIn.duration(CONTROL_SWAP_MS).reduceMotion(ReduceMotion.System);
const CONTROL_OUT = FadeOut.duration(CONTROL_SWAP_MS).reduceMotion(ReduceMotion.System);

/** A measured layout height, rounded up to whole points (a fraction would leave a hairline gap). */
export function measuredHeightOf(event: LayoutChangeEvent): number {
	return Math.ceil(event.nativeEvent.layout.height);
}

export function PageHeader({
	title,
	subtitle,
	titleKey,
	titleDrift,
	leading,
	onMenu,
	onBack,
	onNotifications,
	trailing,
	topInset,
	progress,
	collapseDistance,
	onHeightChange,
	onCollapseDistanceChange,
	testID,
}: PageHeaderProps): React.JSX.Element {
	const [slots, setSlots] = React.useState<TitleSlots>({ current: { key: titleKey, title, subtitle }, leaving: null, drift: titleDrift });
	if (slots.current.key !== titleKey) {
		// A page change: adjusting state to the new props during render (React's documented pattern).
		setSlots({ current: { key: titleKey, title, subtitle }, leaving: slots.current, drift: titleDrift });
	} else if (slots.current.title !== title || slots.current.subtitle !== subtitle) {
		setSlots({ ...slots, current: { key: titleKey, title, subtitle } });
	}
	const topInsetStyle = React.useMemo((): { readonly paddingTop: number } => ({ paddingTop: topInset }), [topInset]);
	const reportHeight = React.useCallback(
		(event: LayoutChangeEvent): void => {
			onHeightChange?.(measuredHeightOf(event));
		},
		[onHeightChange],
	);
	const reportCollapseDistance = React.useCallback(
		(event: LayoutChangeEvent): void => {
			onCollapseDistanceChange?.(measuredHeightOf(event));
		},
		[onCollapseDistanceChange],
	);

	// Only the background moves: its bottom edge rises by the subtitle line's height as the header
	// collapses (a transform, so the header's layout — and the content's clearance — never change).
	const backgroundStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.get() * collapseDistance.get() }] }));
	// The bar turns into the content's surface as the content slides under it.
	const surfaceStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
	const hairlineStyle = useAnimatedStyle(() => ({
		opacity: interpolate(progress.get(), [HAIRLINE_FADE_START, FULLY_COLLAPSED], [HIDDEN, VISIBLE], Extrapolation.CLAMP),
	}));
	// The subtitle line's frame rises with the background's edge and clips the text, which is held in
	// place by an equal and opposite shift: the edge passes over a still line, tucking it away.
	const subtitleClipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.get() * collapseDistance.get() }] }));
	const subtitleStyle = useAnimatedStyle(() => ({
		opacity: VISIBLE - SUBTITLE_FADE(progress.get()),
		transform: [{ translateY: progress.get() * collapseDistance.get() }],
	}));
	const animates = slots.drift !== AT_REST;

	return (
		<View pointerEvents="box-none" onLayout={reportHeight} className="absolute inset-x-0 top-0" style={topInsetStyle} testID={testID}>
			{/* The header's colour, status bar included: it rises from below as the header collapses, and
			    turns into the content's surface, with a hairline along its bottom edge, as it does. Both stay
			    inside the moving layer, so they rise with its edge. */}
			<StyledAnimatedView
				pointerEvents="none"
				className="absolute inset-0 bg-background"
				style={backgroundStyle}
				testID={testID === undefined ? undefined : `${testID}-background`}>
				<StyledAnimatedView className="absolute inset-0 bg-card" style={surfaceStyle} testID={testID === undefined ? undefined : `${testID}-surface`} />
				<StyledAnimatedView className="absolute inset-x-0 bottom-0 h-px bg-border" style={hairlineStyle} testID={testID === undefined ? undefined : `${testID}-hairline`} />
			</StyledAnimatedView>
			<View pointerEvents="box-none" className="px-3">
				<View pointerEvents="box-none" className="h-14 flex-row items-center gap-2" testID={testID === undefined ? undefined : `${testID}-controls`}>
					<View className="size-11">
						{leading === "menu" ? (
							<StyledAnimatedView key="menu" entering={CONTROL_IN} exiting={CONTROL_OUT} className="absolute inset-0">
								<HeaderIconButton icon={MenuIcon} accessibilityLabel="Open menu" onPress={onMenu} testID={testID === undefined ? undefined : `${testID}-menu`} />
							</StyledAnimatedView>
						) : (
							<StyledAnimatedView key="back" entering={CONTROL_IN} exiting={CONTROL_OUT} className="absolute inset-0">
								<HeaderIconButton icon={ArrowLeftIcon} accessibilityLabel="Back" onPress={onBack} testID={testID === undefined ? undefined : `${testID}-back`} />
							</StyledAnimatedView>
						)}
					</View>
					<View pointerEvents="none" className="h-11 flex-1 justify-center overflow-hidden">
						{slots.leaving === null ? null : (
							<StyledAnimatedView
								key={`leaving:${slots.leaving.key}:${slots.current.key}`}
								entering={titleLeaving(slots.drift)}
								accessibilityElementsHidden
								importantForAccessibility="no-hide-descendants"
								className="absolute inset-x-0 opacity-0">
								<Title title={slots.leaving.title} />
							</StyledAnimatedView>
						)}
						<StyledAnimatedView key={slots.current.key} {...(animates ? { entering: titleEntering(slots.drift) } : {})}>
							<Title title={slots.current.title} testID={testID} />
						</StyledAnimatedView>
					</View>
					{trailing === undefined ? null : (
						<View pointerEvents="none" className="flex-row items-center gap-1.5">
							{trailing}
						</View>
					)}
					<HeaderIconButton
						icon={BellIcon}
						accessibilityLabel="Notifications"
						onPress={onNotifications}
						testID={testID === undefined ? undefined : `${testID}-notifications`}
					/>
				</View>
			</View>
			{/* Indented by the buttons' width, so the subtitle sits between them, under the title. */}
			<StyledAnimatedView
				pointerEvents="none"
				onLayout={reportCollapseDistance}
				className="overflow-hidden px-16 pb-4"
				style={subtitleClipStyle}
				testID={testID === undefined ? undefined : `${testID}-subtitle-clip`}>
				<StyledAnimatedView style={subtitleStyle} testID={testID === undefined ? undefined : `${testID}-subtitle-text`}>
					<StyledAnimatedView key={slots.current.key} {...(animates ? { entering: CONTROL_IN } : {})}>
						<Text numberOfLines={1} className="text-center font-sans text-sm text-muted-foreground" testID={testID === undefined ? undefined : `${testID}-subtitle`}>
							{slots.current.subtitle}
						</Text>
					</StyledAnimatedView>
				</StyledAnimatedView>
			</StyledAnimatedView>
		</View>
	);
}

interface TitleProps {
	readonly title: string;
	readonly testID?: string | undefined;
}

function Title({ title, testID }: TitleProps): React.JSX.Element {
	return (
		<Text
			accessibilityRole="header"
			numberOfLines={1}
			className="text-center font-heading text-xl text-foreground"
			testID={testID === undefined ? undefined : `${testID}-title`}>
			{title}
		</Text>
	);
}

interface HeaderIconButtonProps {
	readonly icon: LucideIcon;
	readonly accessibilityLabel: string;
	readonly onPress: () => void;
	readonly testID: string | undefined;
}

/** A 44 pt round icon button with no resting fill — a press shows a soft circle. */
function HeaderIconButton({ icon, accessibilityLabel, onPress, testID }: HeaderIconButtonProps): React.JSX.Element {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			onPress={onPress}
			hitSlop={4}
			testID={testID}
			className="size-11 items-center justify-center rounded-full active:bg-muted">
			<Icon icon={icon} size="md" colorClassName="accent-foreground" />
		</Pressable>
	);
}
