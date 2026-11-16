// A two-state button: pressed or not ("Bold", "Show archived"). Controlled
// and data-agnostic: `pressed` in, `onChange(next)` out (the web kit's
// `pressed` / `onPressedChange`). A screen reader hears a toggle button and
// whether it is on. `ToggleGroup` lays several out as one choice.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { playSelectionFeedback } from "../lib/haptics";
import { Icon, type IconSize, type LucideIcon } from "./icon";

export const toggleVariants = cva("flex-row items-center justify-center gap-1.5 active:opacity-80", {
	variants: {
		/** `default`: borderless until pressed. `outline`: always bordered. `pill`: a round chip, solid brand while pressed (a feed's filters). */
		variant: {
			default: "border border-transparent",
			outline: "border border-input",
			pill: "border border-transparent",
		},
		/** `sm` is 36 pt tall; its touch area still reaches 44 pt. */
		size: {
			sm: "min-h-9 min-w-9 rounded-md px-2.5",
			md: "min-h-11 min-w-11 rounded-lg px-3",
			lg: "min-h-12 min-w-12 rounded-lg px-3.5",
		},
		/** On: the spec's selected fill (`surface-selected`). */
		pressed: {
			true: "bg-surface-selected",
			false: "bg-transparent",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	compoundVariants: [
		{ variant: "pill", className: "rounded-full" },
		{ variant: "pill", pressed: true, className: "bg-primary" },
		{ variant: "pill", pressed: false, className: "bg-muted" },
	],
	defaultVariants: { variant: "default", size: "md", pressed: false, state: "default" },
});

export const toggleLabelVariants = cva("font-sans-medium", {
	variants: {
		variant: { default: "", outline: "", pill: "" },
		size: { sm: "text-body", md: "text-body", lg: "text-body-lg" },
		pressed: { true: "text-secondary-foreground", false: "text-foreground" },
	},
	compoundVariants: [{ variant: "pill", pressed: true, className: "text-primary-foreground" }],
	defaultVariants: { variant: "default", size: "md", pressed: false },
});

type ToggleVariantProps = VariantProps<typeof toggleVariants>;
export type ToggleVariant = NonNullable<ToggleVariantProps["variant"]>;
export type ToggleSize = NonNullable<ToggleVariantProps["size"]>;

/** The glyph's and spinner's colour, pressed or not (Uniwind `accent-*` → the native `color` prop). */
export function toggleContentColorOf(pressed: boolean, variant: ToggleVariant = "default"): string {
	if (!pressed) {
		return "accent-foreground";
	}
	return variant === "pill" ? "accent-primary-foreground" : "accent-secondary-foreground";
}

/** The glyph's size step per toggle size. */
export const TOGGLE_ICON_SIZE: Readonly<Record<ToggleSize, IconSize>> = { sm: "sm", md: "md", lg: "md" };

/** Extra touch area of a compact toggle: 36 pt plus 4 pt each side is the 44 pt minimum (rules/04). */
export const TOGGLE_SMALL_HIT_SLOP = 4;

export interface ToggleProps {
	/** What the toggle shows, and its accessible name. */
	readonly label: string;
	/** A glyph before the label; decorative. */
	readonly icon?: LucideIcon | undefined;
	/** The glyph while pressed, in place of `icon` (a filled heart, a muted speaker). */
	readonly pressedIcon?: LucideIcon | undefined;
	/** The label while pressed, in place of `label` ("Bookmarked"); also its accessible name then. */
	readonly pressedLabel?: string | undefined;
	/** Something small after the label (a count, a badge); say it in `accessibilityHint` when it matters. */
	readonly trailing?: React.ReactNode;
	/** Show only the glyph (the label still names it for screen readers). Needs `icon`. */
	readonly hideLabel?: boolean | undefined;
	readonly pressed: boolean;
	readonly onChange: (pressed: boolean) => void;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly variant?: ToggleVariant | undefined;
	readonly size?: ToggleSize | undefined;
	readonly disabled?: boolean | undefined;
	/** The change is being saved: shows a spinner and blocks presses. */
	readonly loading?: boolean | undefined;
	/** The caller's validation outcome. */
	readonly invalid?: boolean | undefined;
	/** A long press (a tooltip explaining the control hands it its own). */
	readonly onLongPress?: (() => void) | undefined;
	/** The finger lifted (a tooltip hides its bubble). */
	readonly onPressOut?: (() => void) | undefined;
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the toggle, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Toggle = React.memo(
	React.forwardRef<ViewInstance, ToggleProps>(function Toggle(
		{
			label,
			icon,
			pressedIcon,
			pressedLabel,
			trailing,
			hideLabel = false,
			pressed,
			onChange,
			onFocus,
			onBlur,
			onLongPress,
			onPressOut,
			variant = "default",
			size = "md",
			disabled = false,
			loading = false,
			invalid = false,
			accessibilityHint,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ checked: pressed, disabled: isInactive, busy: loading }), [isInactive, loading, pressed]);
		const handlePress = React.useCallback((): void => {
			playSelectionFeedback();
			onChange(!pressed);
		}, [onChange, pressed]);
		const contentColor = toggleContentColorOf(pressed, variant);
		const showsLabel = !hideLabel || icon === undefined;
		const glyph = pressed ? (pressedIcon ?? icon) : icon;
		const shownLabel = pressed ? (pressedLabel ?? label) : label;
		return (
			<Pressable
				ref={ref}
				accessibilityRole="togglebutton"
				accessibilityLabel={shownLabel}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={handlePress}
				onFocus={onFocus}
				onBlur={onBlur}
				onLongPress={onLongPress}
				onPressOut={onPressOut}
				hitSlop={size === "sm" ? TOGGLE_SMALL_HIT_SLOP : undefined}
				testID={testID}
				className={cn(toggleVariants({ variant, size, pressed, state }), className)}>
				{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : null}
				{glyph === undefined || loading ? null : <Icon icon={glyph} size={TOGGLE_ICON_SIZE[size]} colorClassName={contentColor} />}
				{showsLabel ? (
					<Text numberOfLines={1} className={cn(toggleLabelVariants({ variant, size, pressed }))}>
						{shownLabel}
					</Text>
				) : null}
				{trailing}
			</Pressable>
		);
	}),
);
