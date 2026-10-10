// The floating tab bar: a compact pill that hovers above the bottom safe area
// and hugs its tabs. The selected tab grows into a solid capsule (`primary`)
// holding its icon and label; the others show only their icon. Every change
// springs on the UI thread (Reanimated) without overshoot, and follows the OS
// "Reduce Motion" setting (ADR 036).
//
// Presentational and controlled: the caller (src/features/navigation/app-tab-bar.tsx)
// says which tabs exist, which one is selected and what a press does. Colours
// are token utilities only, so the bar follows the light and dark themes.

import * as React from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { SELECTION_SPRING } from "../lib/motion";
import { Icon, type LucideIcon } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

/** The selection progress a tab animates between. */
const UNSELECTED = 0;
const SELECTED = 1;
/** Opacity end points. */
const HIDDEN = 0;
const VISIBLE = 1;

/** The label fades in over the last part of the expansion, once there is room for it. */
const LABEL_FADE_START = 0.45;
/** Space between the selected tab's icon and its label, in points. */
const LABEL_GAP = 6;
/** Large system text still grows the label, up to this factor, so the bar never overflows. */
const LABEL_MAX_FONT_SCALE = 1.3;
/** Space between the bar and the bottom safe area, in points. */
const BAR_BOTTOM_GAP = 12;

/** Shared by the visible label and its measuring copy, so both lay out alike. */
const LABEL_CLASSES = "font-sans-semibold text-sm text-primary-foreground";

export interface FloatingTabBarItem {
	/** Stable identity of the tab (the route key). */
	readonly key: string;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly selected: boolean;
	readonly onPress: () => void;
	readonly onLongPress?: () => void;
	readonly testID?: string;
}

export interface FloatingTabBarProps {
	readonly items: readonly FloatingTabBarItem[];
	/** The bottom safe-area inset (home indicator, gesture bar), in points. */
	readonly bottomInset: number;
	/**
	 * Reports the height the bar covers at the bottom of the screen (bar, gap
	 * and safe area), so scrolling content can keep clear of it.
	 */
	readonly onHeightChange?: ((height: number) => void) | undefined;
	readonly testID?: string;
}

export function FloatingTabBar({ items, bottomInset, onHeightChange, testID }: FloatingTabBarProps): React.JSX.Element {
	const reportHeight = React.useCallback(
		(event: LayoutChangeEvent): void => {
			onHeightChange?.(event.nativeEvent.layout.height);
		},
		[onHeightChange],
	);
	const insetStyle = React.useMemo((): { readonly paddingBottom: number } => ({ paddingBottom: bottomInset + BAR_BOTTOM_GAP }), [bottomInset]);

	return (
		// `box-none`: the transparent band around the bar lets touches through to the screen.
		<View pointerEvents="box-none" onLayout={reportHeight} style={insetStyle} className="absolute inset-x-0 bottom-0 items-center px-4" testID={testID}>
			<View
				accessibilityRole="tablist"
				{...(testID === undefined ? {} : { testID: `${testID}-tablist` })}
				className="w-full max-w-85 flex-row items-center justify-between rounded-full border border-border bg-card p-1.5 shadow-lg">
				{items.map((item: FloatingTabBarItem): React.JSX.Element => (
					<FloatingTab key={item.key} item={item} />
				))}
			</View>
		</View>
	);
}

interface FloatingTabProps {
	readonly item: FloatingTabBarItem;
}

function FloatingTab({ item }: FloatingTabProps): React.JSX.Element {
	const { label, icon, selected, onPress, onLongPress, testID } = item;
	const progress = useSharedValue(selected ? SELECTED : UNSELECTED);
	// The label's natural width (capped), measured once off-screen: the capsule animates to it.
	const [labelWidth, setLabelWidth] = React.useState(0);

	React.useEffect((): void => {
		progress.set(withSpring(selected ? SELECTED : UNSELECTED, SELECTION_SPRING));
	}, [progress, selected]);

	const measureLabel = React.useCallback((event: LayoutChangeEvent): void => {
		setLabelWidth(Math.ceil(event.nativeEvent.layout.width));
	}, []);

	const capsuleStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
	const restingIconStyle = useAnimatedStyle(() => ({ opacity: VISIBLE - progress.get() }));
	const selectedIconStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
	const labelSlotStyle = useAnimatedStyle(() => ({
		width: progress.get() * labelWidth,
		marginLeft: progress.get() * LABEL_GAP,
		opacity: interpolate(progress.get(), [LABEL_FADE_START, SELECTED], [HIDDEN, VISIBLE], Extrapolation.CLAMP),
	}));
	const labelStyle = React.useMemo((): { readonly width: number } => ({ width: labelWidth }), [labelWidth]);

	return (
		<Pressable
			accessibilityRole="tab"
			accessibilityLabel={label}
			accessibilityState={{ selected }}
			onPress={onPress}
			onLongPress={onLongPress}
			testID={testID}
			className="h-12 min-w-12 flex-row items-center justify-center rounded-full px-3 active:opacity-70">
			<StyledAnimatedView className="absolute inset-0 rounded-full bg-primary" style={capsuleStyle} />
			<View className="size-6 items-center justify-center">
				<StyledAnimatedView className="absolute" style={restingIconStyle}>
					<Icon icon={icon} colorClassName="accent-muted-foreground" />
				</StyledAnimatedView>
				<StyledAnimatedView style={selectedIconStyle}>
					<Icon icon={icon} weight="bold" colorClassName="accent-primary-foreground" />
				</StyledAnimatedView>
			</View>
			<StyledAnimatedView className="overflow-hidden" style={labelSlotStyle}>
				<Text numberOfLines={1} maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE} style={labelStyle} className={LABEL_CLASSES}>
					{label}
				</Text>
			</StyledAnimatedView>
			{/* The measuring copy: a wide, invisible box lets the label take its natural width. */}
			<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="absolute top-0 left-0 w-96 opacity-0">
				<Text
					numberOfLines={1}
					maxFontSizeMultiplier={LABEL_MAX_FONT_SCALE}
					onLayout={measureLabel}
					{...(testID === undefined ? {} : { testID: `${testID}-label-measure` })}
					className={`max-w-28 self-start ${LABEL_CLASSES}`}>
					{label}
				</Text>
			</View>
		</Pressable>
	);
}
