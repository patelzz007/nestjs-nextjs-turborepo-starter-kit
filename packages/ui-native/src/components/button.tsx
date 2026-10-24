// A pressable action. Data-agnostic and controlled: the caller says what it
// does (`label`), what happens (`onPress`) and whether it is busy or
// disabled. Variants, sizes and states come from CVA over design tokens only.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, type GestureResponderEvent, type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

export const buttonVariants = cva("flex-row items-center justify-center gap-2 active:opacity-80", {
	variants: {
		variant: {
			primary: "bg-primary",
			secondary: "border border-border bg-card",
			destructive: "bg-destructive",
			ghost: "bg-transparent",
		},
		/** `md`: a form's or a screen's action. `sm`: a compact pill beside other content; its touch area still reaches 44 pt. */
		size: {
			md: "min-h-11 rounded-lg px-4 py-3",
			sm: "min-h-9 rounded-full px-3.5 py-1.5",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border border-destructive",
		},
	},
	defaultVariants: { variant: "primary", size: "md", state: "default" },
});

export const buttonLabelVariants = cva("font-sans-semibold shrink", {
	variants: {
		variant: {
			primary: "text-primary-foreground",
			secondary: "text-foreground",
			destructive: "text-status-foreground",
			ghost: "text-primary",
		},
		size: { md: "text-base", sm: "text-sm" },
	},
	defaultVariants: { variant: "primary", size: "md" },
});

/** The spinner's and icon's colour per variant (Uniwind `accent-*` → the native `color` prop). */
const CONTENT_COLOR: Readonly<Record<ButtonVariant, string>> = {
	primary: "accent-primary-foreground",
	secondary: "accent-foreground",
	destructive: "accent-status-foreground",
	ghost: "accent-primary",
};

type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;

/** Extra touch area of a compact button: 36 pt tall plus 4 pt each side is the 44 pt minimum (rules/04). */
const SMALL_HIT_SLOP = 4;

export interface ButtonProps {
	readonly label: string;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly variant?: ButtonVariant;
	readonly size?: ButtonSize;
	/** A glyph before the label; decorative — the label names the action. */
	readonly icon?: LucideIcon;
	/** A request is in flight: shows a spinner and blocks presses. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	/** The caller's validation outcome for the action (rare: a submit whose form is invalid). */
	readonly invalid?: boolean;
	/** What happens on press, for screen readers when the label alone is not enough. */
	readonly accessibilityHint?: string;
	/** Overrides the accessible name (defaults to `label`). */
	readonly accessibilityLabel?: string;
	/** Extra classes for the container, merged last (layout: `flex-1`, `self-start`). */
	readonly className?: string;
	readonly testID?: string;
}

export const Button = React.memo(
	React.forwardRef<ViewInstance, ButtonProps>(function Button(
		{
			label,
			onPress,
			onFocus,
			onBlur,
			variant = "primary",
			size = "md",
			icon,
			loading = false,
			disabled = false,
			invalid = false,
			accessibilityHint,
			accessibilityLabel,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		const contentColor = CONTENT_COLOR[variant];
		return (
			<Pressable
				ref={ref}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel ?? label}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={onPress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				hitSlop={size === "sm" ? SMALL_HIT_SLOP : undefined}
				className={cn(buttonVariants({ variant, size, state }), className)}>
				{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : null}
				{icon === undefined || loading ? null : <Icon icon={icon} size="sm" colorClassName={contentColor} />}
				{/* One line, always: a button is never taller than its row (the caller gives it the width it needs). */}
				<Text numberOfLines={1} className={buttonLabelVariants({ variant, size })}>
					{label}
				</Text>
			</Pressable>
		);
	}),
);
