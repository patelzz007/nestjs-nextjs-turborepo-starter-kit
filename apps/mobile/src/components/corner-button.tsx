// A quiet round button fixed in the screen's top-left corner, above whatever
// screen is showing (the app drawer's menu button, ADR 038). Rendered once by a
// layout and never re-mounted: it fades in and out instead, and takes no
// touches and is hidden from screen readers while invisible. Page-coloured,
// translucent, hairline-bordered and shadowless — present without announcing
// itself. Presentational: the caller says what it is, does, and when it shows.

import * as React from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { CORNER_FADE } from "../lib/motion";
import { Icon, type LucideIcon } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

const HIDDEN = 0;
const VISIBLE = 1;
/** From the top of the safe area and the left edge, in points: in line with a screen's title. */
const CORNER_OFFSET_TOP = 24;
const CORNER_OFFSET_LEFT = 20;

export interface CornerButtonProps {
	readonly icon: LucideIcon;
	/** What the button does, for screen readers ("Open menu"). */
	readonly accessibilityLabel: string;
	readonly onPress: () => void;
	readonly visible: boolean;
	/** The top safe-area inset, in points. */
	readonly topInset: number;
	readonly testID?: string;
}

export function CornerButton({ icon, accessibilityLabel, onPress, visible, topInset, testID }: CornerButtonProps): React.JSX.Element {
	const opacity = useSharedValue(visible ? VISIBLE : HIDDEN);

	React.useEffect((): void => {
		opacity.set(withTiming(visible ? VISIBLE : HIDDEN, CORNER_FADE));
	}, [opacity, visible]);

	const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
	const position = React.useMemo((): { readonly top: number; readonly left: number } => ({ top: topInset + CORNER_OFFSET_TOP, left: CORNER_OFFSET_LEFT }), [topInset]);

	return (
		<StyledAnimatedView
			pointerEvents={visible ? "auto" : "none"}
			accessibilityElementsHidden={!visible}
			importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
			className="absolute"
			style={[position, fadeStyle]}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
				onPress={onPress}
				hitSlop={4}
				testID={testID}
				className="size-11 items-center justify-center rounded-full border border-border bg-background/90 active:opacity-70">
				<Icon icon={icon} size="md" colorClassName="accent-foreground" />
			</Pressable>
		</StyledAnimatedView>
	);
}
