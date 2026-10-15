// A pressable action. Data-agnostic and controlled: the caller says what it
// does (label), what happens (onPress) and whether it is busy or disabled.

import * as React from "react";
import { ActivityIndicator, Pressable, Text, type View } from "react-native";

import { Icon, type LucideIcon } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

/** `md`: a form's or a screen's action. `sm`: a compact pill beside other content (a header); its touch area still reaches 44 pt. */
export type ButtonSize = "md" | "sm";

const SIZE_CLASSES: Readonly<Record<ButtonSize, { readonly container: string; readonly label: string }>> = {
	md: { container: "min-h-11 rounded-lg px-4 py-3", label: "text-base" },
	sm: { container: "min-h-9 rounded-full px-3.5 py-1.5", label: "text-sm" },
};

/** Extra touch area of a compact button: 36 pt tall plus 4 pt each side is the 44 pt minimum (rules/04). */
const SMALL_HIT_SLOP = 4;

/** Container and label classes per variant — design tokens only (ADR 030). */
const VARIANT_CLASSES: Readonly<Record<ButtonVariant, { readonly container: string; readonly label: string; readonly spinner: string }>> = {
	primary: { container: "bg-primary", label: "text-primary-foreground", spinner: "accent-primary-foreground" },
	secondary: { container: "border border-border bg-card", label: "text-foreground", spinner: "accent-foreground" },
	destructive: { container: "bg-destructive", label: "text-status-foreground", spinner: "accent-status-foreground" },
	ghost: { container: "bg-transparent", label: "text-primary", spinner: "accent-primary" },
};

export interface ButtonProps {
	readonly label: string;
	readonly onPress: () => void;
	readonly variant?: ButtonVariant;
	readonly size?: ButtonSize;
	/** A glyph before the label (an external-link arrow for "View on GitHub"); decorative — the label names the action. */
	readonly icon?: LucideIcon;
	/** A request is in flight: shows a spinner and blocks presses. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	/** What happens on press, for screen readers when the label alone is not enough. */
	readonly accessibilityHint?: string;
	/** Overrides the accessible name (defaults to `label`). */
	readonly accessibilityLabel?: string;
	readonly testID?: string;
}

/** Minimum touch target height (44 pt, platform guidance — rules/04). */
export const Button = React.forwardRef<View, ButtonProps>(function Button(
	{ label, onPress, variant = "primary", size = "md", icon, loading = false, disabled = false, accessibilityHint, accessibilityLabel, testID },
	ref,
): React.JSX.Element {
	const classes = VARIANT_CLASSES[variant];
	const sizing = SIZE_CLASSES[size];
	const isInactive = disabled || loading;
	return (
		<Pressable
			ref={ref}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: isInactive, busy: loading }}
			disabled={isInactive}
			onPress={onPress}
			testID={testID}
			hitSlop={size === "sm" ? SMALL_HIT_SLOP : undefined}
			className={`flex-row items-center justify-center gap-2 active:opacity-80 ${sizing.container} ${classes.container} ${isInactive ? "opacity-60" : ""}`}>
			{loading ? <ActivityIndicator size="small" colorClassName={classes.spinner} /> : null}
			{icon === undefined || loading ? null : <Icon icon={icon} size="sm" colorClassName={classes.spinner} />}
			{/* One line, always: a button is never taller than its row (the caller gives it the width it needs). */}
			<Text numberOfLines={1} className={`font-sans-semibold shrink ${sizing.label} ${classes.label}`}>
				{label}
			</Text>
		</Pressable>
	);
});
