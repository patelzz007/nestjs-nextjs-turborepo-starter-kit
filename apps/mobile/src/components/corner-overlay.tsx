// A slot fixed in one of the screen's top corners, above whatever screen is
// showing — where a layout puts its own controls (the app drawer's menu button
// on the left, the status pills on the right). Rendered once by a layout and
// never re-mounted: it fades in and out instead, and takes no touches and is
// hidden from screen readers while invisible. Presentational: the caller
// supplies the content and says when it shows.

import * as React from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { CORNER_FADE } from "../lib/motion";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

const HIDDEN = 0;
const VISIBLE = 1;
/** From the top of the safe area and the side edge, in points: in line with a screen's title. */
const CORNER_OFFSET_TOP = 24;
const CORNER_OFFSET_SIDE = 20;

export type CornerSide = "left" | "right";

type CornerPosition = { readonly top: number; readonly left: number } | { readonly top: number; readonly right: number };

export interface CornerOverlayProps {
	readonly side: CornerSide;
	readonly visible: boolean;
	/** The top safe-area inset, in points. */
	readonly topInset: number;
	readonly children: React.ReactNode;
	readonly testID?: string;
}

export function CornerOverlay({ side, visible, topInset, children, testID }: CornerOverlayProps): React.JSX.Element {
	const opacity = useSharedValue(visible ? VISIBLE : HIDDEN);

	React.useEffect((): void => {
		opacity.set(withTiming(visible ? VISIBLE : HIDDEN, CORNER_FADE));
	}, [opacity, visible]);

	const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
	const position = React.useMemo((): CornerPosition => {
		const top = topInset + CORNER_OFFSET_TOP;
		return side === "left" ? { top, left: CORNER_OFFSET_SIDE } : { top, right: CORNER_OFFSET_SIDE };
	}, [side, topInset]);

	return (
		<StyledAnimatedView
			// `box-none`: the slot itself never catches a touch; only its controls do.
			pointerEvents={visible ? "box-none" : "none"}
			accessibilityElementsHidden={!visible}
			importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
			className="absolute"
			style={[position, fadeStyle]}
			testID={testID}>
			{children}
		</StyledAnimatedView>
	);
}
