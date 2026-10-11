// A choice between a few short, equal options in one row ("7D · 30D · 90D"):
// the selected segment sits on a raised thumb that slides to the new one on
// the selection spring (no overshoot; still under Reduce Motion). Read by
// screen readers as a radio group, each segment by its full name ("Last 7
// days"). Generic over the option value, controlled: `value` in,
// `onChange(next)` out.

import * as React from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { playSelectionFeedback } from "../lib/haptics";
import { SELECTION_SPRING } from "../lib/motion";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

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
	readonly value: TValue;
	readonly onChange: (value: TValue) => void;
	readonly testID?: string;
}

/** The track's inner padding (`p-1`), in points: the thumb lines up inside it. */
const TRACK_PADDING = 4;

export function SegmentedControl<TValue extends string>({ label, options, value, onChange, testID }: SegmentedControlProps<TValue>): React.JSX.Element {
	const [trackWidth, setTrackWidth] = React.useState(0);
	const selectedIndex = Math.max(
		0,
		options.findIndex((option: SegmentedOption<TValue>): boolean => option.value === value),
	);
	const segmentWidth = options.length === 0 ? 0 : Math.max(0, trackWidth - 2 * TRACK_PADDING) / options.length;
	const offset = useSharedValue(0);
	const hasMeasured = React.useRef(false);

	React.useEffect((): void => {
		const target = selectedIndex * segmentWidth;
		// The first measurement places the thumb; only later changes slide it.
		offset.set(hasMeasured.current ? withSpring(target, SELECTION_SPRING) : target);
		hasMeasured.current = segmentWidth > 0;
	}, [offset, segmentWidth, selectedIndex]);

	const measure = React.useCallback((event: LayoutChangeEvent): void => {
		setTrackWidth(event.nativeEvent.layout.width);
	}, []);
	const thumbStyle = useAnimatedStyle(() => ({ width: segmentWidth, transform: [{ translateX: offset.get() }] }));

	return (
		<View accessibilityRole="radiogroup" accessibilityLabel={label} onLayout={measure} className="flex-row rounded-xl bg-muted p-1" testID={testID}>
			{trackWidth > 0 ? <StyledAnimatedView style={thumbStyle} className="absolute top-1 bottom-1 left-1 rounded-lg bg-card shadow-sm" /> : null}
			{options.map((option: SegmentedOption<TValue>): React.JSX.Element => (
				<Segment key={option.value} option={option} selected={option.value === value} onSelect={onChange} />
			))}
		</View>
	);
}

interface SegmentProps<TValue extends string> {
	readonly option: SegmentedOption<TValue>;
	readonly selected: boolean;
	readonly onSelect: (value: TValue) => void;
}

function Segment<TValue extends string>({ option, selected, onSelect }: SegmentProps<TValue>): React.JSX.Element {
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
			accessibilityState={{ checked: selected }}
			onPress={press}
			className="min-h-11 flex-1 items-center justify-center rounded-lg px-2">
			<Text className={`font-sans-semibold text-sm ${selected ? "text-foreground" : "text-muted-foreground"}`}>{option.label}</Text>
		</Pressable>
	);
}
