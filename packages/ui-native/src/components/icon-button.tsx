// A square button that is only a glyph ("Add a picture" beside a comment's
// buttons). Its name is spoken, never shown, so `label` is required.
// Data-agnostic and controlled: busy shows a spinner and blocks presses; the
// touch target is the 44 pt minimum (rules/04). Variants, sizes and states
// come from CVA over design tokens only (the shape of button.tsx).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, type GestureResponderEvent, type NativeSyntheticEvent, Pressable, type TargetedEvent, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

export const iconButtonVariants = cva("items-center justify-center active:opacity-80", {
	variants: {
		/** `secondary`: the outlined look of a secondary button (the default). `primary`: filled. `ghost`: the glyph alone. */
		variant: {
			secondary: "border border-border bg-card",
			primary: "border border-primary bg-primary",
			ghost: "border border-transparent bg-transparent",
		},
		/** `md`: 44 pt. `sm`: 36 pt beside dense content; its touch area still reaches 44 pt. */
		size: {
			md: "size-11 rounded-lg",
			sm: "size-9 rounded-md",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "secondary", size: "md", state: "default" },
});

type IconButtonVariantProps = VariantProps<typeof iconButtonVariants>;
export type IconButtonVariant = NonNullable<IconButtonVariantProps["variant"]>;
export type IconButtonSize = NonNullable<IconButtonVariantProps["size"]>;

/** The glyph's and spinner's colour per variant (Uniwind `accent-*` → the native `color` prop). */
const CONTENT_COLOR: Readonly<Record<IconButtonVariant, string>> = {
	secondary: "accent-foreground",
	primary: "accent-primary-foreground",
	ghost: "accent-foreground",
};

/** Extra touch area of a compact button: 36 pt plus 4 pt each side is the 44 pt minimum (rules/04). */
const SMALL_HIT_SLOP = 4;

export interface IconButtonProps {
	readonly icon: LucideIcon;
	/** The accessible name — what the button does ("Add a picture"). */
	readonly label: string;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly variant?: IconButtonVariant;
	readonly size?: IconButtonSize;
	/** Work is in flight: a spinner in place of the glyph, and presses are blocked. */
	readonly loading?: boolean;
	readonly disabled?: boolean;
	/** The caller's validation outcome for the action (rare). */
	readonly invalid?: boolean;
	readonly accessibilityHint?: string;
	/** Extra classes for the button, merged last (layout: `self-end`). */
	readonly className?: string;
	readonly testID?: string;
}

export const IconButton = React.memo(
	React.forwardRef<ViewInstance, IconButtonProps>(function IconButton(
		{ icon, label, onPress, onFocus, onBlur, variant = "secondary", size = "md", loading = false, disabled = false, invalid = false, accessibilityHint, className, testID },
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
				accessibilityLabel={label}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={onPress}
				onFocus={onFocus}
				onBlur={onBlur}
				testID={testID}
				hitSlop={size === "sm" ? SMALL_HIT_SLOP : undefined}
				className={cn(iconButtonVariants({ variant, size, state }), className)}>
				{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : <Icon icon={icon} size={size === "sm" ? "sm" : "md"} colorClassName={contentColor} />}
			</Pressable>
		);
	}),
);
