// A value picked along a track (volume, a price ceiling). Pure JavaScript:
// React Native's gesture responder over a token-styled track, and a thumb
// placed by a Reanimated style. Controlled and data-agnostic: `value` in,
// `onChange(next)` out while the thumb is dragged, and `onChangeEnd(final)`
// once it is let go (the web kit's `onValueChange` / `onValueCommitted`).
// Screen readers hear an adjustable control: swiping up or down steps it.
// The track's measured width and the drag in progress are display state.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

/** The touch area: at least 44 pt tall, whatever the track's size (rules/04). */
export const sliderVariants = cva("min-h-11 justify-center", {
	variants: {
		variant: { default: "" },
		size: { md: "", sm: "" },
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The row the thumb rides in: as tall as the thumb, the track centred in it. */
export const sliderRailVariants = cva("justify-center", {
	variants: { size: { md: "h-6", sm: "h-5" } },
	defaultVariants: { size: "md" },
});

export const sliderTrackVariants = cva("overflow-hidden rounded-full bg-muted", {
	variants: { size: { md: "h-1.5", sm: "h-1" } },
	defaultVariants: { size: "md" },
});

/** The filled part of the track, from the start to the thumb. */
export const sliderRangeVariants = cva("absolute top-0 bottom-0 left-0 rounded-full", {
	variants: {
		state: { default: "bg-primary", loading: "bg-primary", disabled: "bg-primary", error: "bg-destructive" },
	},
	defaultVariants: { state: "default" },
});

export const sliderThumbVariants = cva("absolute top-0 left-0 rounded-full border-2 bg-card shadow-sm", {
	variants: {
		size: { md: "size-6", sm: "size-5" },
		state: { default: "border-primary", loading: "border-primary", disabled: "border-primary", error: "border-destructive" },
	},
	defaultVariants: { size: "md", state: "default" },
});

type SliderVariantProps = VariantProps<typeof sliderVariants>;
export type SliderVariant = NonNullable<SliderVariantProps["variant"]>;
export type SliderSize = NonNullable<SliderVariantProps["size"]>;

/** The thumb's side per size, in points (`size-6`, `size-5`). */
export const SLIDER_THUMB_SIZE: Readonly<Record<SliderSize, number>> = { md: 24, sm: 20 };

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;
const NO_WIDTH = 0;
const START_FRACTION = 0;
const END_FRACTION = 1;
const HALF = 2;

/** The bounds and the step a value snaps to. */
export interface SliderRange {
	readonly min: number;
	readonly max: number;
	readonly step: number;
}

/** `value`, kept within `min`–`max`. */
export function clampSliderValue(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** The digits after the decimal point in `step` ("0.25" → 2), so snapped values print cleanly. */
function decimalsOf(step: number): number {
	const [, fraction = ""] = String(step).split(".");
	return fraction.length;
}

/** `raw`, snapped to the nearest step from `min`, within the bounds. */
export function snapSliderValue(raw: number, range: SliderRange): number {
	const steps = Math.round((raw - range.min) / range.step);
	const snapped = Number((range.min + steps * range.step).toFixed(decimalsOf(range.step)));
	return clampSliderValue(snapped, range.min, range.max);
}

/** How far along the track `value` sits, 0 (min) to 1 (max). */
export function sliderFractionOf(value: number, min: number, max: number): number {
	return max > min ? (clampSliderValue(value, min, max) - min) / (max - min) : START_FRACTION;
}

/**
 * The value under a touch `x` points from the track's start. The thumb's
 * centre follows the finger, so the ends are half a thumb in from the edges.
 */
export function sliderValueAt(x: number, trackWidth: number, thumbSize: number, range: SliderRange): number {
	const travel = trackWidth - thumbSize;
	const fraction = travel > NO_WIDTH ? clampSliderValue((x - thumbSize / HALF) / travel, START_FRACTION, END_FRACTION) : START_FRACTION;
	return snapSliderValue(range.min + fraction * (range.max - range.min), range);
}

/** The actions screen readers offer (swipe up / down on iOS, volume keys on Android). */
const ADJUSTABLE_ACTIONS: readonly { readonly name: string }[] = [{ name: "increment" }, { name: "decrement" }];

export interface SliderProps {
	readonly value: number;
	/** The value while the thumb moves (each step it crosses), and on each screen-reader step. */
	readonly onChange: (value: number) => void;
	/** The value the thumb was let go at (save it here, not on every move). */
	readonly onChangeEnd?: (value: number) => void;
	readonly min?: number;
	readonly max?: number;
	/** The value snaps to multiples of this from `min`. */
	readonly step?: number;
	/** The slider's accessible name ("Volume"); a visible label is the caller's (a `Field`). */
	readonly accessibilityLabel: string;
	/** What screen readers say for a value ("40 %", "$1,200"). Defaults to the number. */
	readonly formatValue?: (value: number) => string;
	readonly variant?: SliderVariant;
	readonly size?: SliderSize;
	readonly disabled?: boolean;
	/** The value is being saved: blocks dragging and announces busy. */
	readonly loading?: boolean;
	/** The caller's validation outcome. */
	readonly invalid?: boolean;
	/** Extra classes for the touch area, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** Where a drag started: the touch's offset in the track, and its place on the screen. */
interface DragStart {
	readonly x: number;
	readonly pageX: number;
}

export const Slider = React.memo(
	React.forwardRef<View, SliderProps>(function Slider(
		{
			value,
			onChange,
			onChangeEnd,
			min = DEFAULT_MIN,
			max = DEFAULT_MAX,
			step = DEFAULT_STEP,
			accessibilityLabel,
			formatValue,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const [trackWidth, setTrackWidth] = React.useState(NO_WIDTH);
		const dragStart = React.useRef<DragStart | null>(null);
		const lastValue = React.useRef(value);
		const thumbSize = SLIDER_THUMB_SIZE[size];
		const range = React.useMemo((): SliderRange => ({ min, max, step }), [max, min, step]);
		const fraction = sliderFractionOf(value, min, max);

		const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: fraction * Math.max(trackWidth - thumbSize, NO_WIDTH) }] }));
		const rangeStyle = useAnimatedStyle(() => ({ width: fraction * Math.max(trackWidth - thumbSize, NO_WIDTH) + thumbSize / HALF }));

		const measure = React.useCallback((event: LayoutChangeEvent): void => {
			setTrackWidth(event.nativeEvent.layout.width);
		}, []);
		const report = React.useCallback(
			(next: number): void => {
				if (next !== lastValue.current) {
					lastValue.current = next;
					onChange(next);
				}
			},
			[onChange],
		);
		const canDrag = React.useCallback((): boolean => !isInactive && trackWidth > NO_WIDTH, [isInactive, trackWidth]);
		const keepDrag = React.useCallback((): boolean => false, []);
		const startDrag = React.useCallback(
			(event: GestureResponderEvent): void => {
				const { locationX, pageX } = event.nativeEvent;
				dragStart.current = { x: locationX, pageX };
				lastValue.current = value;
				report(sliderValueAt(locationX, trackWidth, thumbSize, range));
			},
			[range, report, thumbSize, trackWidth, value],
		);
		const moveDrag = React.useCallback(
			(event: GestureResponderEvent): void => {
				const start = dragStart.current;
				if (start !== null) {
					report(sliderValueAt(start.x + event.nativeEvent.pageX - start.pageX, trackWidth, thumbSize, range));
				}
			},
			[range, report, thumbSize, trackWidth],
		);
		const endDrag = React.useCallback((): void => {
			if (dragStart.current !== null) {
				dragStart.current = null;
				onChangeEnd?.(lastValue.current);
			}
		}, [onChangeEnd]);

		const adjust = React.useCallback(
			(event: AccessibilityActionEvent): void => {
				if (isInactive) {
					return;
				}
				const direction = event.nativeEvent.actionName === "increment" ? step : -step;
				const next = snapSliderValue(value + direction, range);
				if (next !== value) {
					lastValue.current = next;
					onChange(next);
					onChangeEnd?.(next);
				}
			},
			[isInactive, onChange, onChangeEnd, range, step, value],
		);

		const accessibilityValue = React.useMemo(
			() => ({ min, max, now: value, ...(formatValue === undefined ? {} : { text: formatValue(value) }) }),
			[formatValue, max, min, value],
		);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);

		return (
			<View
				ref={ref}
				accessible
				accessibilityRole="adjustable"
				accessibilityLabel={accessibilityLabel}
				accessibilityValue={accessibilityValue}
				accessibilityState={accessibilityState}
				accessibilityActions={ADJUSTABLE_ACTIONS}
				onAccessibilityAction={adjust}
				onStartShouldSetResponder={canDrag}
				onMoveShouldSetResponder={canDrag}
				onResponderTerminationRequest={keepDrag}
				onResponderGrant={startDrag}
				onResponderMove={moveDrag}
				onResponderRelease={endDrag}
				onResponderTerminate={endDrag}
				testID={testID}
				className={cn(sliderVariants({ variant, size, state }), className)}>
				{/* Touches land on the touch area itself, so `locationX` is always measured from the track's start. */}
				<View pointerEvents="none" onLayout={measure} testID={testID === undefined ? undefined : `${testID}-rail`} className={sliderRailVariants({ size })}>
					<View className={sliderTrackVariants({ size })}>
						<StyledAnimatedView style={rangeStyle} className={sliderRangeVariants({ state })} />
					</View>
					<StyledAnimatedView style={thumbStyle} className={sliderThumbVariants({ size, state })} />
				</View>
			</View>
		);
	}),
);
