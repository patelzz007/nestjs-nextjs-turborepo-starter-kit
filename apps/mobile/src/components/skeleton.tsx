// Skeletons: the shape of content that is still loading, drawn where it will
// appear, so nothing moves when it arrives (no layout shift). Like the web's
// skeletons: muted blocks that breathe together (Tailwind's `animate-pulse`),
// still while Reduce Motion is on. Presentational: the caller lays out the
// blocks to mirror the real content.
//
// - Skeleton: one block, sized and shaped by `className` (`size-14 rounded-full`).
// - SkeletonText: one line of text — a box exactly the text's line height, with
//   a shorter bar inside — so the placeholder and the text are the same height.
// - SkeletonGroup: wraps a placeholder; it pulses as one (in step, not block by
//   block) and tells screen readers what is loading.

import * as React from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { usePulseStyle } from "../lib/use-pulse-style";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export interface SkeletonProps {
	/** Size and shape as token utilities (`h-12 w-full rounded-xl`). */
	readonly className: string;
	readonly testID?: string;
}

export function Skeleton({ className, testID }: SkeletonProps): React.JSX.Element {
	return <View className={`bg-muted ${className}`} testID={testID} />;
}

/** A text role's line height, and the bar drawn inside it (a little shorter, like the letters' x-height). */
export type SkeletonTextSize = "sm" | "base" | "lg" | "2xl";

const TEXT_SIZE_CLASSES: Readonly<Record<SkeletonTextSize, { readonly line: string; readonly bar: string }>> = {
	sm: { line: "h-5", bar: "h-3" },
	base: { line: "h-6", bar: "h-3.5" },
	lg: { line: "h-7", bar: "h-4" },
	"2xl": { line: "h-8", bar: "h-5" },
};

export interface SkeletonTextProps {
	/** The text role it stands in for: `sm` MutedText, `base` BodyText, `lg` Subheading, `2xl` Heading. */
	readonly size: SkeletonTextSize;
	/** The bar's width as a token utility (`w-40`, `w-3/4`): vary it so lines read as text. */
	readonly widthClassName: string;
	readonly testID?: string;
}

export function SkeletonText({ size, widthClassName, testID }: SkeletonTextProps): React.JSX.Element {
	const classes = TEXT_SIZE_CLASSES[size];
	return (
		<View className={`justify-center ${classes.line}`} testID={testID}>
			<View className={`rounded-full bg-muted ${classes.bar} ${widthClassName}`} />
		</View>
	);
}

export interface SkeletonGroupProps {
	/**
	 * What is loading, for screen readers ("Loading your account"). Leave it out
	 * when another group on the screen already says it: this one is then hidden.
	 */
	readonly accessibilityLabel?: string;
	readonly children: React.ReactNode;
	readonly className?: string;
	readonly testID?: string;
}

export function SkeletonGroup({ accessibilityLabel, children, className = "", testID }: SkeletonGroupProps): React.JSX.Element {
	const pulseStyle = usePulseStyle();
	return (
		<StyledAnimatedView
			{...(accessibilityLabel === undefined
				? { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" }
				: { accessible: true, accessibilityRole: "progressbar", accessibilityLabel, accessibilityState: { busy: true } })}
			className={className}
			style={pulseStyle}
			testID={testID}>
			{children}
		</StyledAnimatedView>
	);
}
