// The app's motion: named springs for Reanimated (ADR 036). Components never
// hand-type spring physics; they pick one of these, so the app moves as one.
// Every spring follows the OS "Reduce Motion" setting: with it on, the value
// jumps to its target instead of animating.

import { MOTION } from "@workspace/tokens";
import { Easing, ReduceMotion, type EasingFunction, type WithSpringConfig, type WithTimingConfig } from "react-native-reanimated";

/**
 * Selection changes that move layout (the tab bar's expanding tab). Critically
 * damped and clamped: it eases into place without overshooting. Overshoot
 * would make a growing tab briefly too wide and a shrinking one too narrow,
 * and every neighbour would wobble left and right before settling.
 */
export const SELECTION_SPRING: WithSpringConfig = {
	/** Perceived duration in ms (Reanimated settles the tail over ~1.5×). */
	duration: 380,
	dampingRatio: 1,
	overshootClamping: true,
	reduceMotion: ReduceMotion.System,
};

/**
 * Panels that slide in from an edge (the app drawer). Critically damped and
 * clamped like SELECTION_SPRING, so a panel never bounces past the edge.
 */
export const PANEL_SPRING: WithSpringConfig = {
	/** Perceived duration in ms (Reanimated settles the tail over ~1.5×). */
	duration: 340,
	dampingRatio: 1,
	overshootClamping: true,
	reduceMotion: ReduceMotion.System,
};

export interface PulseMotion {
	/** One full fade out and back, in ms. */
	readonly cycleMs: number;
	/** The faintest the element gets, half-way through the cycle. */
	readonly minOpacity: number;
	readonly easing: EasingFunction;
}

/**
 * A slow breathing fade for a "live" indicator (the auth panel's status dot):
 * exactly Tailwind's `animate-pulse`, which the web panel uses — a 2 s cycle,
 * fading to half opacity at its middle, on cubic-bezier(0.4, 0, 0.6, 1).
 */
export const PULSE: PulseMotion = {
	cycleMs: 2000,
	minOpacity: 0.5,
	easing: Easing.bezierFn(0.4, 0, 0.6, 1),
};

/** A layout control appearing or leaving with the screen under it (the corner menu button): a short, plain fade. */
export const CORNER_FADE: WithTimingConfig = {
	duration: 180,
	reduceMotion: ReduceMotion.System,
};

const { "ease-emphasized-enter": EMPHASIZED_ENTER } = MOTION;

/** The tokens' `ease-emphasized-enter` (decelerating: quick start, long settle), as a Reanimated easing. */
export const EMPHASIZED_ENTER_EASING: EasingFunction = Easing.bezierFn(EMPHASIZED_ENTER.x1, EMPHASIZED_ENTER.y1, EMPHASIZED_ENTER.x2, EMPHASIZED_ENTER.y2);

/** The launch screen's opening moment (LaunchScreen): the mark settles and lifts, the words rise under it. */
export const LAUNCH_MOTION = {
	/** The faces part, then spring back together. */
	partMs: 260,
	settleSpring: { duration: 520, dampingRatio: 0.82, reduceMotion: ReduceMotion.System } satisfies WithSpringConfig,
	/** The mark lifts to make room for the words. */
	liftDelayMs: 140,
	liftMs: 640,
	/** The words fade up under the mark. */
	wordsDelayMs: 320,
	wordsMs: 560,
	/** Light travels once around the cube in this long, for as long as the app is starting. */
	lightCycleMs: 2400,
	lightDelayMs: 900,
} satisfies Readonly<Record<string, number | WithSpringConfig>>;
