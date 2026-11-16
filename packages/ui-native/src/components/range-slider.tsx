// Several thumbs on one track (the web kit's `Slider` with an array value): a
// range's two ends (a price from–to), or more stops. A touch moves the thumb
// nearest to it; each thumb stays between its neighbours, `minDistance`
// apart. Controlled: `value` (the thumbs' values, in order) in,
// `onChange(next)` out while dragging, `onChangeEnd(final)` when let go.
// Each thumb is its own adjustable control for screen readers, named by
// `thumbLabels` ("Minimum price", "Maximum price"). The track, the filled
// part between the first and last thumbs, and the thumbs share `Slider`'s
// look and helpers.

import { cva } from "class-variance-authority";
import * as React from "react";
import { type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import {
	SLIDER_THUMB_SIZE,
	sliderFractionOf,
	sliderRailVariants,
	sliderRangeVariants,
	sliderThumbVariants,
	sliderTrackVariants,
	sliderValueAt,
	snapSliderValue,
	type SliderRange,
	type SliderSize,
} from "./slider";

export const rangeSliderVariants = cva("py-2.5", {
	variants: { state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" } },
	defaultVariants: { state: "default" },
});

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;
const NO_WIDTH = 0;
const HALF = 2;

/** `values` with the thumb at `index` moved to `next`, kept between its neighbours `minDistance` apart and within the bounds. */
export function moveThumb(values: readonly number[], index: number, next: number, range: SliderRange, minDistance: number): readonly number[] {
	const lower = index === 0 ? range.min : (values.at(index - 1) ?? range.min) + minDistance;
	const upper = index === values.length - 1 ? range.max : (values.at(index + 1) ?? range.max) - minDistance;
	const clamped = Math.min(Math.max(next, lower), upper);
	return values.map((value: number, position: number): number => (position === index ? clamped : value));
}

/** The thumb nearest to `value` (the later one on a tie, so a thumb dragged onto another can move on past it). */
export function nearestThumb(values: readonly number[], value: number): number {
	let best = 0;
	values.forEach((thumb: number, index: number): void => {
		if (Math.abs(thumb - value) <= Math.abs((values.at(best) ?? thumb) - value)) {
			best = index;
		}
	});
	return best;
}

export interface RangeSliderProps {
	/** The thumbs' values, in order along the track. */
	readonly value: readonly number[];
	readonly onChange: (value: readonly number[]) => void;
	readonly onChangeEnd?: ((value: readonly number[]) => void) | undefined;
	readonly min?: number | undefined;
	readonly max?: number | undefined;
	readonly step?: number | undefined;
	/** The least gap between two thumbs. Default 0. */
	readonly minDistance?: number | undefined;
	/** Each thumb's name for screen readers, in order ("Minimum price", "Maximum price"). */
	readonly thumbLabels: readonly string[];
	readonly formatValue?: ((value: number) => string) | undefined;
	readonly size?: SliderSize | undefined;
	readonly disabled?: boolean | undefined;
	readonly invalid?: boolean | undefined;
	/** Extra classes for the touch area, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

const ADJUSTABLE_ACTIONS: readonly { readonly name: string }[] = [{ name: "increment" }, { name: "decrement" }];

interface ThumbProps {
	readonly index: number;
	readonly value: number;
	readonly label: string;
	readonly offset: number;
	readonly size: SliderSize;
	readonly state: "default" | "error";
	readonly min: number;
	readonly max: number;
	readonly formatValue: ((value: number) => string) | undefined;
	readonly onStep: (index: number, direction: 1 | -1) => void;
	readonly testID: string | undefined;
}

/** One thumb: placed along the track, adjustable on its own for screen readers. */
const Thumb = React.memo(function Thumb({ index, value, label, offset, size, state, min, max, formatValue, onStep, testID }: ThumbProps): React.JSX.Element {
	const style = React.useMemo(() => ({ transform: [{ translateX: offset }] }), [offset]);
	const accessibilityValue = React.useMemo(
		() => ({ min, max, now: value, ...(formatValue === undefined ? {} : { text: formatValue(value) }) }),
		[formatValue, max, min, value],
	);
	const adjust = React.useCallback(
		(event: AccessibilityActionEvent): void => {
			onStep(index, event.nativeEvent.actionName === "increment" ? 1 : -1);
		},
		[index, onStep],
	);
	return (
		<View
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={label}
			accessibilityValue={accessibilityValue}
			accessibilityActions={ADJUSTABLE_ACTIONS}
			onAccessibilityAction={adjust}
			style={style}
			testID={testID}
			className={sliderThumbVariants({ size, state })}
		/>
	);
});

export const RangeSlider = React.memo(
	React.forwardRef<ViewInstance, RangeSliderProps>(function RangeSlider(
		{
			value,
			onChange,
			onChangeEnd,
			min = DEFAULT_MIN,
			max = DEFAULT_MAX,
			step = DEFAULT_STEP,
			minDistance = 0,
			thumbLabels,
			formatValue,
			size = "md",
			disabled = false,
			invalid = false,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, invalid });
		const isInactive = isInactiveState(state);
		const [trackWidth, setTrackWidth] = React.useState<number>(NO_WIDTH);
		const [dragging, setDragging] = React.useState<number | null>(null);
		const thumbSize = SLIDER_THUMB_SIZE[size];
		const travel = Math.max(trackWidth - thumbSize, NO_WIDTH);
		const range = React.useMemo((): SliderRange => ({ min, max, step }), [max, min, step]);
		const offsetOf = (thumb: number): number => sliderFractionOf(thumb, min, max) * travel;
		const first = value.at(0) ?? min;
		const last = value.at(-1) ?? max;
		const filledStyle = { left: offsetOf(first) + thumbSize / HALF, width: Math.max(offsetOf(last) - offsetOf(first), NO_WIDTH) };
		const measure = React.useCallback((event: LayoutChangeEvent): void => {
			setTrackWidth(event.nativeEvent.layout.width);
		}, []);
		const canDrag = React.useCallback((): boolean => !isInactive && trackWidth > NO_WIDTH, [isInactive, trackWidth]);
		const keepDrag = React.useCallback((): boolean => false, []);
		const startDrag = React.useCallback(
			(event: GestureResponderEvent): void => {
				const at = sliderValueAt(event.nativeEvent.locationX, trackWidth, thumbSize, range);
				const index = nearestThumb(value, at);
				setDragging(index);
				onChange(moveThumb(value, index, at, range, minDistance));
			},
			[minDistance, onChange, range, thumbSize, trackWidth, value],
		);
		const moveDrag = React.useCallback(
			(event: GestureResponderEvent): void => {
				if (dragging !== null) {
					onChange(moveThumb(value, dragging, sliderValueAt(event.nativeEvent.locationX, trackWidth, thumbSize, range), range, minDistance));
				}
			},
			[dragging, minDistance, onChange, range, thumbSize, trackWidth, value],
		);
		const endDrag = React.useCallback((): void => {
			if (dragging !== null) {
				setDragging(null);
				onChangeEnd?.(value);
			}
		}, [dragging, onChangeEnd, value]);
		const stepThumb = React.useCallback(
			(index: number, direction: 1 | -1): void => {
				if (isInactive) {
					return;
				}
				const next = moveThumb(value, index, snapSliderValue((value.at(index) ?? min) + direction * step, range), range, minDistance);
				onChange(next);
				onChangeEnd?.(next);
			},
			[isInactive, min, minDistance, onChange, onChangeEnd, range, step, value],
		);
		const thumbState = state === "error" ? "error" : "default";
		return (
			<View
				ref={ref}
				onStartShouldSetResponder={canDrag}
				onMoveShouldSetResponder={canDrag}
				onResponderTerminationRequest={keepDrag}
				onResponderGrant={startDrag}
				onResponderMove={moveDrag}
				onResponderRelease={endDrag}
				onResponderTerminate={endDrag}
				testID={testID}
				className={cn(rangeSliderVariants({ state }), className)}>
				<View onLayout={measure} testID={testID === undefined ? undefined : `${testID}-rail`} className={sliderRailVariants({ size })}>
					<View pointerEvents="none" className={sliderTrackVariants({ size })}>
						<View style={filledStyle} className={sliderRangeVariants({ state })} />
					</View>
					{value.map((thumb: number, index: number): React.JSX.Element => (
						<Thumb
							key={`thumb-${String(index)}`}
							index={index}
							value={thumb}
							label={thumbLabels.at(index) ?? `Thumb ${String(index + 1)}`}
							offset={offsetOf(thumb)}
							size={size}
							state={thumbState}
							min={min}
							max={max}
							formatValue={formatValue}
							onStep={stepThumb}
							testID={testID === undefined ? undefined : `${testID}-thumb-${String(index)}`}
						/>
					))}
				</View>
			</View>
		);
	}),
);
