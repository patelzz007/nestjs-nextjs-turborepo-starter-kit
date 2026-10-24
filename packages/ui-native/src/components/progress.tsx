// A linear progress bar for work whose amount is known (an upload's bytes, a
// step of a flow). Controlled: the caller passes `value` out of `max`, and the
// bar fills to match — easing to each new value, and jumping there under
// Reduce Motion. Screen readers hear it as a progress bar with its value.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming, type WithTimingConfig } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { EMPHASIZED_ENTER_EASING, PAGE_CHANGE_MS } from "../lib/motion";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export const progressVariants = cva("w-full flex-row overflow-hidden rounded-full bg-muted", {
	variants: {
		variant: { default: "", success: "", warning: "", destructive: "" },
		size: { sm: "h-1", md: "h-1.5", lg: "h-2.5" },
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The filled part. An error turns it destructive whatever the variant. */
export const progressIndicatorVariants = cva("h-full basis-0 rounded-full", {
	variants: {
		variant: {
			default: "bg-primary",
			success: "bg-success",
			warning: "bg-warning",
			destructive: "bg-destructive",
		},
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "bg-destructive",
		},
	},
	defaultVariants: { variant: "default", state: "default" },
});

type ProgressVariantProps = VariantProps<typeof progressVariants>;
export type ProgressVariant = NonNullable<ProgressVariantProps["variant"]>;
export type ProgressSize = NonNullable<ProgressVariantProps["size"]>;

const MIN_VALUE = 0;
const DEFAULT_MAX = 100;
const FULL = 1;

/** A new value eases in like a page change: long enough to read as motion, short enough never to lag. */
const FILL_TIMING: WithTimingConfig = { duration: PAGE_CHANGE_MS, easing: EMPHASIZED_ENTER_EASING, reduceMotion: ReduceMotion.System };

/** How full the bar is, 0–1: `value` out of `max`, clamped (a value past either end draws an empty or a full bar). */
export function progressFractionOf(value: number, max: number): number {
	if (max <= MIN_VALUE) {
		return MIN_VALUE;
	}
	return Math.min(Math.max(value, MIN_VALUE), max) / max;
}

/** The fill and the rest of the track share the track's width by their grow factors (fraction and 1 − fraction). */
interface GrowStyle {
	readonly flexGrow: number;
}

export interface ProgressProps {
	/** How much is done, from 0 to `max`. */
	readonly value: number;
	/** The value of finished work (default 100). */
	readonly max?: number;
	/** What is progressing, for screen readers ("Uploading photo"). */
	readonly accessibilityLabel: string;
	/** The value as words, when a number alone says too little ("3 of 5 files"). */
	readonly valueText?: string;
	readonly variant?: ProgressVariant;
	readonly size?: ProgressSize;
	/** Paused or not yet started: dimmed. */
	readonly disabled?: boolean;
	/** Waiting for the next value (a stalled upload retrying): dimmed and announced busy. */
	readonly loading?: boolean;
	/** The work failed: the fill turns destructive. */
	readonly invalid?: boolean;
	/** Extra classes for the track, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Progress = React.memo(
	React.forwardRef<ViewInstance, ProgressProps>(function Progress(
		{ value, max = DEFAULT_MAX, accessibilityLabel, valueText, variant = "default", size = "md", disabled = false, loading = false, invalid = false, className, testID },
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const fraction = progressFractionOf(value, max);
		const fill = useSharedValue(fraction);

		React.useEffect((): void => {
			fill.set(withTiming(fraction, FILL_TIMING));
		}, [fill, fraction]);

		const fillStyle = useAnimatedStyle((): GrowStyle => ({ flexGrow: fill.get() }));
		const restStyle = useAnimatedStyle((): GrowStyle => ({ flexGrow: FULL - fill.get() }));
		const clampedValue = Math.min(Math.max(value, MIN_VALUE), Math.max(max, MIN_VALUE));
		const accessibilityValue = React.useMemo(
			() => ({ min: MIN_VALUE, max, now: clampedValue, ...(valueText === undefined ? {} : { text: valueText }) }),
			[clampedValue, max, valueText],
		);
		const accessibilityState = React.useMemo(() => ({ disabled, busy: loading }), [disabled, loading]);

		return (
			<View
				ref={ref}
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={accessibilityValue}
				accessibilityState={accessibilityState}
				testID={testID}
				className={cn(progressVariants({ variant, size, state }), className)}>
				<StyledAnimatedView style={fillStyle} className={progressIndicatorVariants({ variant, state })} testID={testID === undefined ? undefined : `${testID}-indicator`} />
				<StyledAnimatedView style={restStyle} className="basis-0" />
			</View>
		);
	}),
);
