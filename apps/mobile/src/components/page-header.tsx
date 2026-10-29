// The page header, on the page's own colour like the status bar above it (the app draws edge to
// edge). It has two parts:
//
// - the pinned row — the leading control (the menu, or back) on the left, the app's status (the
//   `trailing` slot: connection and session) and the notifications button on the right and, between
//   them, the page's title. The row never moves.
// - the subtitle line — centred under the title, between the two buttons. As the page scrolls
//   (`progress` 0 → 1, src/lib/page-header-scroll.tsx) the header shrinks with the content and the
//   subtitle fades out, leaving one slim bar that still shows the menu, the title and notifications.
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

const HIDDEN = 0;
const VISIBLE = 1;
const AT_REST = 0;
const EXPANDED = 0;
/** The subtitle is gone by the time the header is this far collapsed. */
export const SUBTITLE_FADE_END = 0.6;

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

	// The header moves up with the content; the pinned row moves down by as much, so it stays put.
	const bandStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -progress.get() * collapseDistance.get() }] }));
	const pinnedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: progress.get() * collapseDistance.get() }] }));
	const subtitleStyle = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [EXPANDED, SUBTITLE_FADE_END], [VISIBLE, HIDDEN], Extrapolation.CLAMP) }));
	const animates = slots.drift !== AT_REST;

	return (
		<StyledAnimatedView pointerEvents="box-none" onLayout={reportHeight} className="absolute inset-x-0 top-0 bg-background" style={[topInsetStyle, bandStyle]} testID={testID}>
			<StyledAnimatedView pointerEvents="box-none" className="z-10 bg-background px-3" style={pinnedStyle}>
				<View pointerEvents="box-none" className="h-14 flex-row items-center gap-2">
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
			</StyledAnimatedView>
			{/* Indented by the buttons' width, so the subtitle sits between them, under the title. */}
			<View pointerEvents="none" onLayout={reportCollapseDistance} className="px-16 pb-4" testID={testID === undefined ? undefined : `${testID}-subtitle-line`}>
				<StyledAnimatedView style={subtitleStyle}>
					<StyledAnimatedView key={slots.current.key} {...(animates ? { entering: CONTROL_IN } : {})}>
						<Text numberOfLines={1} className="text-center font-sans text-sm text-muted-foreground" testID={testID === undefined ? undefined : `${testID}-subtitle`}>
							{slots.current.subtitle}
						</Text>
					</StyledAnimatedView>
				</StyledAnimatedView>
			</View>
		</StyledAnimatedView>
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
