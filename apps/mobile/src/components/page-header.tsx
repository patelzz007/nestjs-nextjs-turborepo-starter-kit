// The page header: a leading control (the menu, or back), the page's title and
// a trailing slot (status), laid over the top of the page. It is deliberately
// not a bar — no band, no divider, no shadow. It sits on the page's own colour
// and the title is set as the page heading, so at rest it reads as the page's
// first line. Below it, the page colour fades to transparent: content scrolling
// up dissolves under the controls instead of colliding with them.
//
// Presentational and controlled: the caller gives the title, which control
// leads and what it does. The header owns only its motion — a new `titleKey`
// brings the new title in from `titleDrift` points away while the old one
// leaves the other way (the page transition's timing), and the leading control
// cross-fades when it changes. Both follow the OS "Reduce Motion" setting.

import ArrowLeftIcon from "lucide-react-native/icons/arrow-left";
import MenuIcon from "lucide-react-native/icons/menu";
import * as React from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion, withTiming, type LayoutAnimation } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { CONTROL_SWAP_MS, PAGE_TITLE_TIMING } from "../lib/motion";
import { Icon } from "./icon";

const StyledAnimatedView = withUniwind(Animated.View);
const StyledAnimatedText = withUniwind(Animated.Text);

/** The controls' row, below the status bar (`h-14`). */
export const PAGE_HEADER_ROW_HEIGHT = 56;
/** The fade below the row (`h-5`): content at rest starts below it, so nothing is dimmed until it scrolls up. */
export const PAGE_HEADER_FADE_HEIGHT = 20;

const HIDDEN = 0;
const VISIBLE = 1;
const AT_REST = 0;

export type PageHeaderLeading = "menu" | "back";

export interface PageHeaderProps {
	/** The page's title, read by screen readers as the page heading. */
	readonly title: string;
	/** Identifies the page: a new key moves the title; the same key with a new title just updates the text. */
	readonly titleKey: string;
	/** Where the incoming title starts, in points: positive from the right, negative from the left. */
	readonly titleDrift: number;
	readonly leading: PageHeaderLeading;
	readonly onMenu: () => void;
	readonly onBack: () => void;
	/** What sits on the right (the app's status pills). */
	readonly trailing?: React.ReactNode;
	/** The status bar's height: the header's colour runs up behind it. */
	readonly topInset: number;
	readonly testID?: string;
}

interface TitleSlot {
	readonly key: string;
	readonly title: string;
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
 * The outgoing title, mounted afresh as its own element so it leaves in the
 * NEW page's direction (an `exiting` animation would keep the one it was
 * rendered with): from its place to `-drift`, fading out.
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

export function PageHeader({ title, titleKey, titleDrift, leading, onMenu, onBack, trailing, topInset, testID }: PageHeaderProps): React.JSX.Element {
	const [slots, setSlots] = React.useState<TitleSlots>({ current: { key: titleKey, title }, leaving: null, drift: titleDrift });
	if (slots.current.key !== titleKey) {
		// A page change: adjusting state to the new props during render (React's documented pattern).
		setSlots({ current: { key: titleKey, title }, leaving: slots.current, drift: titleDrift });
	} else if (slots.current.title !== title) {
		setSlots({ ...slots, current: { key: titleKey, title } });
	}
	const topInsetStyle = React.useMemo((): { readonly paddingTop: number } => ({ paddingTop: topInset }), [topInset]);
	const animates = slots.drift !== AT_REST;

	return (
		<View pointerEvents="box-none" className="absolute inset-x-0 top-0" testID={testID}>
			<View pointerEvents="box-none" className="bg-background" style={topInsetStyle}>
				<View pointerEvents="box-none" className="h-14 flex-row items-center gap-1 pr-4 pl-2">
					<View className="size-11">
						{leading === "menu" ? (
							<StyledAnimatedView key="menu" entering={CONTROL_IN} exiting={CONTROL_OUT} className="absolute inset-0">
								<HeaderIconButton icon="menu" accessibilityLabel="Open menu" onPress={onMenu} testID={testID === undefined ? undefined : `${testID}-menu`} />
							</StyledAnimatedView>
						) : (
							<StyledAnimatedView key="back" entering={CONTROL_IN} exiting={CONTROL_OUT} className="absolute inset-0">
								<HeaderIconButton icon="back" accessibilityLabel="Back" onPress={onBack} testID={testID === undefined ? undefined : `${testID}-back`} />
							</StyledAnimatedView>
						)}
					</View>
					<View pointerEvents="none" className="h-11 flex-1 justify-center overflow-hidden">
						{slots.leaving === null ? null : (
							<StyledAnimatedText
								key={`leaving:${slots.leaving.key}:${slots.current.key}`}
								entering={titleLeaving(slots.drift)}
								numberOfLines={1}
								accessibilityElementsHidden
								importantForAccessibility="no-hide-descendants"
								className="absolute inset-x-0 font-heading text-2xl text-foreground opacity-0">
								{slots.leaving.title}
							</StyledAnimatedText>
						)}
						<StyledAnimatedText
							key={slots.current.key}
							{...(animates ? { entering: titleEntering(slots.drift) } : {})}
							accessibilityRole="header"
							numberOfLines={1}
							className="font-heading text-2xl text-foreground"
							testID={testID === undefined ? undefined : `${testID}-title`}>
							{slots.current.title}
						</StyledAnimatedText>
					</View>
					{trailing === undefined ? null : (
						<View pointerEvents="none" className="flex-row items-center gap-1.5">
							{trailing}
						</View>
					)}
				</View>
			</View>
			{/* The page colour fading out below the controls: invisible at rest (page on page), a soft edge once content scrolls under it. */}
			<View pointerEvents="none" className="h-5 bg-linear-to-b from-background to-transparent" />
		</View>
	);
}

interface HeaderIconButtonProps {
	readonly icon: PageHeaderLeading;
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
			<Icon icon={icon === "menu" ? MenuIcon : ArrowLeftIcon} size="md" colorClassName="accent-foreground" />
		</Pressable>
	);
}
