// An indeterminate busy indicator: the platform's own activity indicator,
// coloured with a token (never a colour value). For a small, unpredictably
// shaped piece of UI only — a whole section or screen loads behind a skeleton
// shaped like its content (rules/07, "Loading skeletons"). With an
// `accessibilityLabel` it is announced as a busy progress bar; without one it
// is decorative (the control around it already says it is busy).
// `LoadingDots` is the playful companion: three dots that bounce in turn.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, View, type ViewInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { useReduceMotion } from "../lib/use-reduce-motion";

const StyledAnimatedView = withUniwind(Animated.View);

export const spinnerVariants = cva("items-center justify-center", {
	variants: {
		variant: { default: "", muted: "", primary: "" },
		/** `sm`: inline with text or inside a control. `lg`: alone in an empty area. */
		size: { sm: "", lg: "" },
		state: {
			default: "",
			loading: "",
			disabled: "opacity-60",
			error: "",
		},
	},
	defaultVariants: { variant: "default", size: "sm", state: "default" },
});

/** The indicator's colour (Uniwind `accent-*` → the native `color` prop). An error turns it destructive. */
export const spinnerColorVariants = cva("", {
	variants: {
		variant: {
			default: "accent-foreground",
			muted: "accent-muted-foreground",
			primary: "accent-primary",
		},
		state: {
			default: "",
			loading: "",
			disabled: "",
			error: "accent-destructive",
		},
	},
	defaultVariants: { variant: "default", state: "default" },
});

type SpinnerVariantProps = VariantProps<typeof spinnerVariants>;
export type SpinnerVariant = NonNullable<SpinnerVariantProps["variant"]>;
export type SpinnerSize = NonNullable<SpinnerVariantProps["size"]>;

/** The native indicator's own two sizes. */
const NATIVE_SIZE: Readonly<Record<SpinnerSize, "small" | "large">> = {
	sm: "small",
	lg: "large",
};

const BUSY_STATE = { busy: true };

export interface SpinnerProps {
	readonly variant?: SpinnerVariant;
	readonly size?: SpinnerSize;
	/** What is loading, for screen readers. Leave it out when the control around it already says so. */
	readonly accessibilityLabel?: string;
	/** Dims the indicator (the control it sits in is disabled). */
	readonly disabled?: boolean;
	/** The work it stands for failed: the indicator turns destructive. */
	readonly invalid?: boolean;
	/** An `accent-*` token utility that overrides the variant's colour. */
	readonly colorClassName?: string;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Spinner = React.memo(
	React.forwardRef<ViewInstance, SpinnerProps>(function Spinner(
		{ variant = "default", size = "sm", accessibilityLabel, disabled = false, invalid = false, colorClassName, className, testID },
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, invalid });
		const isAnnounced = accessibilityLabel !== undefined;
		return (
			<View
				ref={ref}
				accessible={isAnnounced}
				accessibilityRole={isAnnounced ? "progressbar" : "none"}
				accessibilityLabel={accessibilityLabel}
				accessibilityState={isAnnounced ? BUSY_STATE : undefined}
				accessibilityElementsHidden={!isAnnounced}
				importantForAccessibility={isAnnounced ? "yes" : "no-hide-descendants"}
				testID={testID}
				className={cn(spinnerVariants({ variant, size, state }), className)}>
				<ActivityIndicator
					size={NATIVE_SIZE[size]}
					colorClassName={cn(spinnerColorVariants({ variant, state }), colorClassName)}
					testID={testID === undefined ? undefined : `${testID}-indicator`}
				/>
			</View>
		);
	}),
);

/** One of the loading dots: the primary colour by default. */
export const loadingDotVariants = cva("rounded-full", {
	variants: {
		size: { sm: "size-1.5", md: "size-2", lg: "size-2.5" },
	},
	defaultVariants: { size: "md" },
});

export type LoadingDotsSize = NonNullable<VariantProps<typeof loadingDotVariants>["size"]>;

/** How far a dot rises, and how long one bounce and the gap between dots take. */
const DOT_RISE = -4;
const DOT_BOUNCE_MS = 300;
const DOT_STAGGER_MS = 150;
const DOT_INDEXES: readonly number[] = [0, 1, 2];

export interface LoadingDotsProps {
	/** What is loading, for screen readers ("Assistant is typing"). */
	readonly accessibilityLabel: string;
	readonly size?: LoadingDotsSize | undefined;
	/** A fill of the caller's, in place of the primary colour (`bg-muted-foreground`). */
	readonly dotClassName?: string | undefined;
	/** Extra classes for the row, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

function LoadingDot({
	index,
	size,
	dotClassName,
	still,
}: {
	readonly index: number;
	readonly size: LoadingDotsSize;
	readonly dotClassName: string | undefined;
	readonly still: boolean;
}): React.JSX.Element {
	const rise = useSharedValue(0);
	React.useEffect((): void => {
		if (still) {
			return;
		}
		rise.set(withDelay(index * DOT_STAGGER_MS, withRepeat(withSequence(withTiming(DOT_RISE, { duration: DOT_BOUNCE_MS }), withTiming(0, { duration: DOT_BOUNCE_MS })), -1)));
	}, [index, rise, still]);
	const style = useAnimatedStyle(() => ({ transform: [{ translateY: rise.get() }] }));
	return <StyledAnimatedView style={style} className={cn(loadingDotVariants({ size }), dotClassName ?? "bg-primary")} />;
}

/** Three dots that bounce in turn (a reply being written); still under Reduce Motion. */
export const LoadingDots = React.memo(
	React.forwardRef<ViewInstance, LoadingDotsProps>(function LoadingDots({ accessibilityLabel, size = "md", dotClassName, className, testID }, ref): React.JSX.Element {
		const still = useReduceMotion();
		return (
			<View
				ref={ref}
				accessible
				accessibilityRole="progressbar"
				accessibilityLabel={accessibilityLabel}
				accessibilityState={BUSY_STATE}
				testID={testID}
				className={cn("flex-row items-center gap-1", className)}>
				{DOT_INDEXES.map((index: number): React.JSX.Element => (
					<LoadingDot key={index} index={index} size={size} dotClassName={dotClassName} still={still} />
				))}
			</View>
		);
	}),
);
