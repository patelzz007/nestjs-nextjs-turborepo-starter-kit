// A two-state button: pressed or not ("Bold", "Show archived"). Controlled
// and data-agnostic: `pressed` in, `onChange(next)` out (the web kit's
// `pressed` / `onPressedChange`). A screen reader hears a toggle button and
// whether it is on. `ToggleGroup` lays several out as one choice.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, Pressable, Text, type NativeSyntheticEvent, type TargetedEvent, type View } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { playSelectionFeedback } from "../lib/haptics";
import { Icon, type IconSize, type LucideIcon } from "./icon";

export const toggleVariants = cva("flex-row items-center justify-center gap-1.5 active:opacity-80", {
	variants: {
		/** `default`: borderless until pressed. `outline`: always bordered. */
		variant: {
			default: "border border-transparent",
			outline: "border border-input",
		},
		/** `sm` is 36 pt tall; its touch area still reaches 44 pt. */
		size: {
			sm: "min-h-9 min-w-9 rounded-md px-2.5",
			md: "min-h-11 min-w-11 rounded-lg px-3",
			lg: "min-h-12 min-w-12 rounded-lg px-3.5",
		},
		pressed: {
			true: "bg-secondary",
			false: "bg-transparent",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border-destructive",
		},
	},
	defaultVariants: { variant: "default", size: "md", pressed: false, state: "default" },
});

export const toggleLabelVariants = cva("font-sans-medium", {
	variants: {
		size: { sm: "text-sm", md: "text-sm", lg: "text-base" },
		pressed: { true: "text-secondary-foreground", false: "text-foreground" },
	},
	defaultVariants: { size: "md", pressed: false },
});

type ToggleVariantProps = VariantProps<typeof toggleVariants>;
export type ToggleVariant = NonNullable<ToggleVariantProps["variant"]>;
export type ToggleSize = NonNullable<ToggleVariantProps["size"]>;

/** The glyph's and spinner's colour, pressed or not (Uniwind `accent-*` → the native `color` prop). */
export function toggleContentColorOf(pressed: boolean): string {
	return pressed ? "accent-secondary-foreground" : "accent-foreground";
}

/** The glyph's size step per toggle size. */
export const TOGGLE_ICON_SIZE: Readonly<Record<ToggleSize, IconSize>> = { sm: "sm", md: "md", lg: "md" };

/** Extra touch area of a compact toggle: 36 pt plus 4 pt each side is the 44 pt minimum (rules/04). */
export const TOGGLE_SMALL_HIT_SLOP = 4;

export interface ToggleProps {
	/** What the toggle shows, and its accessible name. */
	readonly label: string;
	/** A glyph before the label; decorative. */
	readonly icon?: LucideIcon;
	/** Show only the glyph (the label still names it for screen readers). Needs `icon`. */
	readonly hideLabel?: boolean;
	readonly pressed: boolean;
	readonly onChange: (pressed: boolean) => void;
	readonly onFocus?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly onBlur?: (event: NativeSyntheticEvent<TargetedEvent>) => void;
	readonly variant?: ToggleVariant;
	readonly size?: ToggleSize;
	readonly disabled?: boolean;
	/** The change is being saved: shows a spinner and blocks presses. */
	readonly loading?: boolean;
	/** The caller's validation outcome. */
	readonly invalid?: boolean;
	readonly accessibilityHint?: string;
	/** Extra classes for the toggle, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Toggle = React.memo(
	React.forwardRef<View, ToggleProps>(function Toggle(
		{
			label,
			icon,
			hideLabel = false,
			pressed,
			onChange,
			onFocus,
			onBlur,
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
		const contentColor = toggleContentColorOf(pressed);
		const showsLabel = !hideLabel || icon === undefined;
		return (
			<Pressable
				ref={ref}
				accessibilityRole="togglebutton"
				accessibilityLabel={label}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={handlePress}
				onFocus={onFocus}
				onBlur={onBlur}
				hitSlop={size === "sm" ? TOGGLE_SMALL_HIT_SLOP : undefined}
				testID={testID}
				className={cn(toggleVariants({ variant, size, pressed, state }), className)}>
				{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : null}
				{icon === undefined || loading ? null : <Icon icon={icon} size={TOGGLE_ICON_SIZE[size]} colorClassName={contentColor} />}
				{showsLabel ? (
					<Text numberOfLines={1} className={toggleLabelVariants({ size, pressed })}>
						{label}
					</Text>
				) : null}
			</Pressable>
		);
	}),
);
