// An indeterminate busy indicator: the platform's own activity indicator,
// coloured with a token (never a colour value). For a small, unpredictably
// shaped piece of UI only — a whole section or screen loads behind a skeleton
// shaped like its content (rules/07, "Loading skeletons"). With an
// `accessibilityLabel` it is announced as a busy progress bar; without one it
// is decorative (the control around it already says it is busy).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";

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
