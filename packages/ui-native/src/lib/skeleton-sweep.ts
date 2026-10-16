// The loading-skeleton sweep — the web's `skeleton-bone` motion
// (packages/ui styles/components.css) in Reanimated, from the same numbers
// (SKELETON_MOTION in @workspace/tokens). One highlight band crosses the whole
// window and every bone shows its slice of it, so a screen of placeholders
// shimmers as one wave; then the band rests off-screen before the next pass.
// With Reduce Motion on, the bones stay still. A loading group also holds back
// for a beat before it fades in, so a fast load never flashes a skeleton.

import { SKELETON_MOTION, type SkeletonSheen } from "@workspace/tokens";
import * as React from "react";
import { cancelAnimation, Easing, ReduceMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";

import { useReduceMotion } from "./use-reduce-motion";

const { sweepCycleMs, travelFraction, bandStartViewport, bandEndViewport, bandWidthViewport, revealDelayMs, revealMs } = SKELETON_MOTION;
const { x1, y1, x2, y2 } = SKELETON_MOTION.sweepEasing;
/** The pass's easing (CSS `ease-in-out`), as a Reanimated easing. */
const SWEEP_EASING = Easing.bezierFn(x1, y1, x2, y2);

const HIDDEN = 0;
const SHOWN = 1;
const CYCLE_START = 0;
const CYCLE_END = 1;
/** `withRepeat` with a negative count repeats for as long as the group is shown. */
const FOREVER = -1;

/** The pass: the band eases across for `travelFraction` of the cycle… */
const TRAVEL_MS = sweepCycleMs * travelFraction;
/** …then waits past the right edge for the rest of it. */
const REST_MS = sweepCycleMs - TRAVEL_MS;
/** Snapping back to the start happens off-screen, so it takes no time. */
const INSTANT_MS = 0;

/**
 * The band's leading edge, in window points, `pass` (0–1, already eased) of
 * the way from its start off the left edge to its end off the right edge.
 */
export function sweepBandLeft(pass: number, windowWidth: number): number {
	"worklet";
	return (bandStartViewport + pass * (bandEndViewport - bandStartViewport)) * windowWidth;
}

/** The band's width in window points. */
export function sweepBandWidth(windowWidth: number): number {
	return bandWidthViewport * windowWidth;
}

/** The theme's highlight: a token role at an opacity (light lifts toward the card, dark toward the foreground). */
export function sweepSheen(theme: "light" | "dark"): SkeletonSheen {
	return SKELETON_MOTION.sheen[theme];
}

export interface SkeletonSweep {
	/** The pass, eased 0 → 1 over the travel, held at 1 through the rest, then back to 0 — on the UI thread. */
	readonly progress: SharedValue<number>;
	/** The group's opacity: 0 for the reveal delay, then fading to 1. */
	readonly reveal: SharedValue<number>;
	/** False while Reduce Motion is on: bones draw no band. */
	readonly sweeping: boolean;
}

/** One sweep clock and reveal for a skeleton group; its bones read them through context. */
export function useSkeletonSweep(): SkeletonSweep {
	const reduceMotion = useReduceMotion();
	const progress = useSharedValue(CYCLE_START);
	const reveal = useSharedValue(HIDDEN);

	React.useEffect((): (() => void) => {
		reveal.set(withDelay(revealDelayMs, withTiming(SHOWN, { duration: revealMs, reduceMotion: ReduceMotion.System })));
		return (): void => {
			cancelAnimation(reveal);
		};
	}, [reveal]);

	React.useEffect((): (() => void) => {
		progress.set(CYCLE_START);
		if (!reduceMotion) {
			progress.set(
				withRepeat(
					withSequence(withTiming(CYCLE_END, { duration: TRAVEL_MS, easing: SWEEP_EASING }), withDelay(REST_MS, withTiming(CYCLE_START, { duration: INSTANT_MS }))),
					FOREVER,
					false,
				),
			);
		}
		return (): void => {
			cancelAnimation(progress);
		};
	}, [progress, reduceMotion]);

	return React.useMemo((): SkeletonSweep => ({ progress, reveal, sweeping: !reduceMotion }), [progress, reduceMotion, reveal]);
}
