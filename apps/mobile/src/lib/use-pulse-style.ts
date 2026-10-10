// A slow breathing fade — Tailwind's `animate-pulse`, which the web uses for
// its live dot and its skeletons (PULSE in lib/motion.ts) — as an animated
// style. Stays fully opaque while the OS "Reduce Motion" setting is on, as the
// web's `motion-safe:` variant does.

import * as React from "react";
import { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { PULSE } from "./motion";
import { useReduceMotion } from "./use-reduce-motion";

const OPAQUE = 1;
/** The fade runs half a cycle each way. */
const HALF_CYCLE = 2;
/** `withRepeat` with a negative count repeats for as long as the element is shown. */
const FOREVER = -1;

/** The animated `{ opacity }` style to pass to an Animated view. */
export type PulseStyle = ReturnType<typeof useAnimatedStyle<PulseStyleValue>>;

interface PulseStyleValue {
	readonly opacity: number;
}

export function usePulseStyle(): PulseStyle {
	const reduceMotion = useReduceMotion();
	const opacity = useSharedValue(OPAQUE);

	React.useEffect((): (() => void) => {
		if (reduceMotion) {
			opacity.set(OPAQUE);
		} else {
			// Fades out, then back in (`reverse`), for as long as the element is mounted.
			opacity.set(withRepeat(withTiming(PULSE.minOpacity, { duration: PULSE.cycleMs / HALF_CYCLE, easing: PULSE.easing }), FOREVER, true));
		}
		return (): void => {
			cancelAnimation(opacity);
		};
	}, [opacity, reduceMotion]);

	return useAnimatedStyle((): PulseStyleValue => ({ opacity: opacity.get() }));
}
