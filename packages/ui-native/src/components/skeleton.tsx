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

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { useWindowDimensions, View, type LayoutChangeEvent, type ViewProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable, useUniwind, withUniwind } from "uniwind";
import { z } from "zod";

import { cn } from "../lib/cn";
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

/** A group without a label is hidden: another group on the screen already says what is loading. */
type GroupAccessibilityProps = Pick<
	ViewProps,
	"accessible" | "accessibilityRole" | "accessibilityLabel" | "accessibilityState" | "accessibilityElementsHidden" | "importantForAccessibility"
>;
const HIDDEN_GROUP_PROPS: GroupAccessibilityProps = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" };
const BUSY_STATE = { busy: true };

export const skeletonVariants = cva("overflow-hidden bg-muted");

/** A text role's line height, and the bar drawn inside it (a little shorter, like the letters' x-height). */
export const skeletonTextVariants = cva("justify-center", {
	variants: {
		size: { sm: "h-5", base: "h-6", lg: "h-7", "2xl": "h-8" },
	},
	defaultVariants: { size: "base" },
});

export const skeletonTextBarVariants = cva("rounded-full", {
	variants: {
		size: { sm: "h-3", base: "h-3.5", lg: "h-4", "2xl": "h-5" },
	},
	defaultVariants: { size: "base" },
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

interface BandStyle {
	readonly width: number;
	readonly transform: readonly [{ readonly translateX: number }];
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

	const bandStyle = useAnimatedStyle((): BandStyle => ({
		width: bandWidth,
		transform: [{ translateX: sweepBandLeft(progress.get(), windowWidth) - boneX.get() }],
	}));

	return (
		<View ref={anchorRef} onLayout={measure} pointerEvents="none" className="absolute inset-0">
			<StyledAnimatedView className="absolute top-0 bottom-0 left-0" style={bandStyle} testID={testID === undefined ? undefined : `${testID}-sweep`}>
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
			</StyledAnimatedView>
		</View>
	);
}

interface BoneProps {
	readonly className: string;
	readonly testID?: string | undefined;
}

/** A muted block that shows the group's sweep (when there is one and motion is on). */
const Bone = React.forwardRef<View, BoneProps>(function Bone({ className, testID }, ref): React.JSX.Element {
	const context = React.useContext(SweepContext);
	return (
		<View ref={ref} className={cn(skeletonVariants(), className)} testID={testID}>
			{context?.sweep.sweeping === true ? <SweepBand context={context} testID={testID} /> : null}
		</View>
	);
});

export interface SkeletonProps {
	/** Size and shape as token utilities (`h-12 w-full rounded-xl`), merged last. */
	readonly className: string;
	readonly testID?: string;
}

/** One block, sized and shaped by `className` (`size-14 rounded-full`). */
export const Skeleton = React.memo(
	React.forwardRef<View, SkeletonProps>(function Skeleton({ className, testID }, ref): React.JSX.Element {
		return <Bone ref={ref} className={className} testID={testID} />;
	}),
);

export type SkeletonTextSize = NonNullable<VariantProps<typeof skeletonTextVariants>["size"]>;

export interface SkeletonTextProps {
	/** The text role it stands in for: `sm` MutedText, `base` BodyText, `lg` Subheading, `2xl` Heading. */
	readonly size: SkeletonTextSize;
	/** The bar's width as a token utility (`w-40`, `w-3/4`): vary it so lines read as text. */
	readonly widthClassName: string;
	/** Extra classes for the line, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** One line of text: a box exactly the text's line height, with a shorter bar inside, so the placeholder and the text are the same height. */
export const SkeletonText = React.memo(
	React.forwardRef<View, SkeletonTextProps>(function SkeletonText({ size, widthClassName, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(skeletonTextVariants({ size }), className)} testID={testID}>
				<Bone className={cn(skeletonTextBarVariants({ size }), widthClassName)} />
			</View>
		);
	}),
);

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

/** Wraps a placeholder: it owns the sweep and the reveal, and tells screen readers what is loading. */
export const SkeletonGroup = React.memo(
	React.forwardRef<View, SkeletonGroupProps>(function SkeletonGroup({ accessibilityLabel, children, className, testID }, ref): React.JSX.Element {
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
		const accessibilityProps = React.useMemo(
			(): GroupAccessibilityProps =>
				accessibilityLabel === undefined ? HIDDEN_GROUP_PROPS : { accessible: true, accessibilityRole: "progressbar", accessibilityLabel, accessibilityState: BUSY_STATE },
			[accessibilityLabel],
		);

		return (
			<SweepContext.Provider value={context}>
				<StyledAnimatedView ref={ref} {...accessibilityProps} className={cn(className)} style={revealStyle} testID={testID}>
					{children}
				</StyledAnimatedView>
			</SweepContext.Provider>
		);
	}),
);
