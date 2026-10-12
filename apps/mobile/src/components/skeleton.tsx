// Skeletons: the shape of content that is still loading, drawn where it will
// appear, so nothing moves when it arrives (no layout shift). They move like
// the web's (lib/skeleton-sweep.ts): one highlight band crosses the whole
// window and passes over every bone at once, then rests; still while Reduce
// Motion is on. A group waits a beat before it fades in, so a fast load never
// flashes. Presentational: the caller lays out the blocks to mirror the real
// content.
//
// - Skeleton: one block, sized and shaped by `className` (`size-14 rounded-full`).
// - SkeletonText: one line of text — a box exactly the text's line height, with
//   a shorter bar inside — so the placeholder and the text are the same height.
// - SkeletonGroup: wraps a placeholder; it owns the sweep and the reveal, and
//   tells screen readers what is loading.

import * as React from "react";
import { StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable, useUniwind, withUniwind } from "uniwind";
import { z } from "zod";

import { sweepBandLeft, sweepBandWidth, sweepSheen, useSkeletonSweep, type SkeletonSweep } from "../lib/skeleton-sweep";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

const ColorSchema = z.string();
/** The band is transparent at its edges and brightest in its middle, like the web's gradient. */
const BAND_EDGE_OPACITY = 0;
const BAND_EDGE_START = 0;
const BAND_MIDDLE = 0.5;
const BAND_EDGE_END = 1;
/** Characters React's generated ids may carry that do not belong in an SVG `url(#id)` reference. */
const SVG_ID_UNSAFE = /[^A-Za-z0-9_-]/g;
/** Before a bone has measured itself it sits at the window's left edge. */
const UNMEASURED_X = 0;

const styles = StyleSheet.create({
	band: { position: "absolute", top: 0, bottom: 0, left: 0 },
});

interface SweepContextValue {
	readonly sweep: SkeletonSweep;
	/** The highlight's resolved colour and peak opacity for the theme on screen. */
	readonly sheenColor: string;
	readonly sheenOpacity: number;
}

/** The enclosing group's sweep; `null` outside a group, where bones stay still. */
const SweepContext = React.createContext<SweepContextValue | null>(null);

interface SweepBandProps {
	readonly context: SweepContextValue;
	readonly testID: string | undefined;
}

/** A bone's slice of the window-wide band: it sits where the band is, minus where the bone is. */
function SweepBand({ context, testID }: SweepBandProps): React.JSX.Element {
	const { width: windowWidth } = useWindowDimensions();
	// SVG ids are referenced from `url(#…)`: keep only characters every renderer accepts.
	const gradientId = `skeleton-sheen-${React.useId().replace(SVG_ID_UNSAFE, "")}`;
	const anchorRef = React.useRef<View>(null);
	const boneX = useSharedValue(UNMEASURED_X);
	const { progress } = context.sweep;
	const bandWidth = sweepBandWidth(windowWidth);

	const measure = React.useCallback(
		(_event: LayoutChangeEvent): void => {
			anchorRef.current?.measureInWindow((x: number): void => {
				boneX.set(x);
			});
		},
		[boneX],
	);

	const bandStyle = useAnimatedStyle(() => ({
		width: bandWidth,
		transform: [{ translateX: sweepBandLeft(progress.get(), windowWidth) - boneX.get() }],
	}));

	return (
		<View ref={anchorRef} onLayout={measure} pointerEvents="none" style={StyleSheet.absoluteFill}>
			<Animated.View style={[styles.band, bandStyle]} {...(testID === undefined ? {} : { testID: `${testID}-sweep` })}>
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
							<Stop offset={BAND_EDGE_START} stopColor={context.sheenColor} stopOpacity={BAND_EDGE_OPACITY} />
							<Stop offset={BAND_MIDDLE} stopColor={context.sheenColor} stopOpacity={context.sheenOpacity} />
							<Stop offset={BAND_EDGE_END} stopColor={context.sheenColor} stopOpacity={BAND_EDGE_OPACITY} />
						</LinearGradient>
					</Defs>
					<Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
				</Svg>
			</Animated.View>
		</View>
	);
}

interface BoneProps {
	readonly className: string;
	readonly testID?: string | undefined;
}

/** A muted block that shows the group's sweep (when there is one and motion is on). */
function Bone({ className, testID }: BoneProps): React.JSX.Element {
	const context = React.useContext(SweepContext);
	return (
		<View className={`overflow-hidden bg-muted ${className}`} testID={testID}>
			{context?.sweep.sweeping === true ? <SweepBand context={context} testID={testID} /> : null}
		</View>
	);
}

export interface SkeletonProps {
	/** Size and shape as token utilities (`h-12 w-full rounded-xl`). */
	readonly className: string;
	readonly testID?: string;
}

export function Skeleton({ className, testID }: SkeletonProps): React.JSX.Element {
	return <Bone className={className} testID={testID} />;
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
			<Bone className={`rounded-full ${classes.bar} ${widthClassName}`} />
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
	const sweep = useSkeletonSweep();
	const { theme } = useUniwind();
	const sheen = sweepSheen(theme);
	const sheenVariable = useCSSVariable(`--${sheen.role}`);
	const sheenColor = ColorSchema.safeParse(sheenVariable).data;
	const revealStyle = useAnimatedStyle(() => ({ opacity: sweep.reveal.get() }));

	// Until the stylesheet resolves the colour, the bones stay still rather than sweep an unknown colour.
	const context = React.useMemo(
		(): SweepContextValue | null => (sheenColor === undefined ? null : { sweep, sheenColor, sheenOpacity: sheen.opacity }),
		[sheen.opacity, sheenColor, sweep],
	);

	return (
		<SweepContext.Provider value={context}>
			<StyledAnimatedView
				{...(accessibilityLabel === undefined
					? { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" }
					: { accessible: true, accessibilityRole: "progressbar", accessibilityLabel, accessibilityState: { busy: true } })}
				className={className}
				style={revealStyle}
				testID={testID}>
				{children}
			</StyledAnimatedView>
		</SweepContext.Provider>
	);
}
