// A dot that breathes — the "live" indicator on the auth panel's brand tile,
// the same as the web panel's `animate-pulse` dot (PULSE in lib/motion.ts).
// Presentational: the caller sizes and colours it with `className`. It stays
// still while the OS "Reduce Motion" setting is on, as the web's `motion-safe:`
// variant does. Decorative: hidden from screen readers.

import * as React from "react";
import Animated from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { usePulseStyle } from "../lib/use-pulse-style";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export interface PulseDotProps {
	/** Size, shape and colour as token utilities (`size-4 rounded-full bg-success`). */
	readonly className: string;
	readonly testID?: string | undefined;
}

export function PulseDot({ className, testID }: PulseDotProps): React.JSX.Element {
	const pulseStyle = usePulseStyle();

	return <StyledAnimatedView className={className} style={pulseStyle} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID} />;
}
