// A pressable action. Data-agnostic and controlled: the caller says what it
// does (label), what happens (onPress) and whether it is busy or disabled.

import * as React from "react";
import { ActivityIndicator, Pressable, Text, type View } from "react-native";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";

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
	{ label, onPress, variant = "primary", loading = false, disabled = false, accessibilityHint, accessibilityLabel, testID },
	ref,
): React.JSX.Element {
	const classes = VARIANT_CLASSES[variant];
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
			className={`min-h-11 flex-row items-center justify-center gap-2 rounded-lg px-4 py-3 active:opacity-80 ${classes.container} ${isInactive ? "opacity-60" : ""}`}>
			{loading ? <ActivityIndicator size="small" colorClassName={classes.spinner} /> : null}
			<Text className={`font-sans-semibold text-base ${classes.label}`}>{label}</Text>
		</Pressable>
	);
});
