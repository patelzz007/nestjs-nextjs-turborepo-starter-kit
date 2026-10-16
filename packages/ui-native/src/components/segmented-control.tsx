// A choice between a few short, equal options in one row ("7D · 30D · 90D"):
// the selected segment sits on a raised thumb that slides to the new one on
// the selection spring (no overshoot; still under Reduce Motion). Read by
// screen readers as a radio group, each segment by its full name ("Last 7
// days"). Generic over the option value, controlled: `value` in,
// `onChange(next)` out. The track's measured width is the control's only
// display state.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type LayoutChangeEvent, type NativeSyntheticEvent, type TargetedEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { playSelectionFeedback } from "../lib/haptics";
import { SELECTION_SPRING } from "../lib/motion";
import type { ValueHandler } from "../lib/value-handler";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export const segmentedControlVariants = cva("flex-row p-1", {
	variants: {
		/** `default`: the muted track. `outline`: a bordered track on the card colour. */
		variant: {
			default: "bg-muted",
			outline: "border border-border bg-card",
		},
		size: {
			md: "rounded-xl",
			sm: "rounded-lg",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border border-destructive",
		},
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

/** The raised thumb behind the selected segment. */
export const segmentedThumbVariants = cva("absolute top-1 bottom-1 left-1 shadow-sm", {
	variants: {
		variant: { default: "bg-card", outline: "bg-muted" },
		size: { md: "rounded-lg", sm: "rounded-md" },
	},
	defaultVariants: { variant: "default", size: "md" },
});

export const segmentVariants = cva("flex-1 items-center justify-center px-2", {
	variants: {
		size: { md: "min-h-11 rounded-lg", sm: "min-h-9 rounded-md" },
	},
	defaultVariants: { size: "md" },
});

export const segmentLabelVariants = cva("font-sans-semibold", {
	variants: {
		size: { md: "text-sm", sm: "text-xs" },
		selected: { true: "text-foreground", false: "text-muted-foreground" },
	},
	defaultVariants: { size: "md", selected: false },
});

type SegmentedControlVariantProps = VariantProps<typeof segmentedControlVariants>;
export type SegmentedControlVariant = NonNullable<SegmentedControlVariantProps["variant"]>;
export type SegmentedControlSize = NonNullable<SegmentedControlVariantProps["size"]>;

/** Extra touch area of a compact segment: 36 pt tall plus 4 pt each side is the 44 pt minimum (rules/04). */
const SMALL_HIT_SLOP = 4;

export interface SegmentedOption<TValue extends string> {
	readonly value: TValue;
	/** What the segment shows ("7D"). */
	readonly label: string;
	/** What screen readers say, when the label is shorthand ("Last 7 days"). */
	readonly accessibilityLabel?: string;
}

export interface SegmentedControlProps<TValue extends string> {
	/** The group's accessible name ("Date range"). */
	readonly label: string;
	readonly options: readonly SegmentedOption<TValue>[];
	readonly value: NoInfer<TValue>;
	readonly onChange: ValueHandler<TValue>;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly variant?: SegmentedControlVariant;
	readonly size?: SegmentedControlSize;
	readonly disabled?: boolean;
	/** The data for the new choice is loading: blocks presses and announces busy. */
	readonly loading?: boolean;
	/** The caller's validation outcome. */
	readonly invalid?: boolean;
	/** Extra classes for the track, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** `SegmentedControl` keeps its option type through `memo` and `forwardRef`. */
export interface SegmentedControlComponent {
	<TValue extends string>(props: SegmentedControlProps<TValue> & React.RefAttributes<View>): React.ReactNode;
	displayName?: string | undefined;
}

/** The track's inner padding (`p-1`), in points: the thumb lines up inside it. */
const TRACK_PADDING = 4;
/** The padding is on both sides of the track. */
const TRACK_SIDES = 2;
const NO_WIDTH = 0;
const FIRST_SEGMENT = 0;

export const SegmentedControl: SegmentedControlComponent = React.memo(
	React.forwardRef(function SegmentedControl(
		{
			label,
			options,
			value,
			onChange,
			onFocus,
			onBlur,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			className,
			testID,
		}: SegmentedControlProps<string>,
		ref: React.ForwardedRef<View>,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const [trackWidth, setTrackWidth] = React.useState(NO_WIDTH);
		const selectedIndex = Math.max(
			FIRST_SEGMENT,
			options.findIndex((option: SegmentedOption<string>): boolean => option.value === value),
		);
		const segmentWidth = options.length === 0 ? NO_WIDTH : Math.max(NO_WIDTH, trackWidth - TRACK_SIDES * TRACK_PADDING) / options.length;
		const offset = useSharedValue(NO_WIDTH);
		const hasMeasured = React.useRef(false);

		React.useEffect((): void => {
			const target = selectedIndex * segmentWidth;
			// The first measurement places the thumb; only later changes slide it.
			offset.set(hasMeasured.current ? withSpring(target, SELECTION_SPRING) : target);
			hasMeasured.current = segmentWidth > NO_WIDTH;
		}, [offset, segmentWidth, selectedIndex]);

		const measure = React.useCallback((event: LayoutChangeEvent): void => {
			setTrackWidth(event.nativeEvent.layout.width);
		}, []);
		const thumbStyle = useAnimatedStyle(() => ({ width: segmentWidth, transform: [{ translateX: offset.get() }] }));
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);

		return (
			<View
				ref={ref}
				accessibilityRole="radiogroup"
				accessibilityLabel={label}
				accessibilityState={accessibilityState}
				onLayout={measure}
				className={cn(segmentedControlVariants({ variant, size, state }), className)}
				testID={testID}>
				{trackWidth > NO_WIDTH ? <StyledAnimatedView style={thumbStyle} className={segmentedThumbVariants({ variant, size })} /> : null}
				{options.map((option: SegmentedOption<string>): React.JSX.Element => (
					<Segment
						key={option.value}
						option={option}
						selected={option.value === value}
						inactive={isInactive}
						size={size}
						onSelect={onChange}
						onFocus={onFocus}
						onBlur={onBlur}
					/>
				))}
			</View>
		);
	}),
);

interface SegmentProps {
	readonly option: SegmentedOption<string>;
	readonly selected: boolean;
	readonly inactive: boolean;
	readonly size: SegmentedControlSize;
	readonly onSelect: ValueHandler<string>;
	readonly onFocus: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
}

const Segment = React.memo(function Segment({ option, selected, inactive, size, onSelect, onFocus, onBlur }: SegmentProps): React.JSX.Element {
	const accessibilityState = React.useMemo(() => ({ checked: selected, disabled: inactive }), [inactive, selected]);
	const press = React.useCallback((): void => {
		if (!selected) {
			playSelectionFeedback();
			onSelect(option.value);
		}
	}, [onSelect, option.value, selected]);
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityLabel={option.accessibilityLabel ?? option.label}
			accessibilityState={accessibilityState}
			disabled={inactive}
			onPress={press}
			onFocus={onFocus}
			onBlur={onBlur}
			hitSlop={size === "sm" ? SMALL_HIT_SLOP : undefined}
			className={segmentVariants({ size })}>
			<Text numberOfLines={1} className={segmentLabelVariants({ size, selected })}>
				{option.label}
			</Text>
		</Pressable>
	);
});
