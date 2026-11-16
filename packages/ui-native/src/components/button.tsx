// A pressable action. Data-agnostic and controlled: the caller says what it
// does (`label`), what happens (`onPress`) and whether it is busy or
// disabled. Variants, sizes and states come from CVA over design tokens only.
//
// The mobile visual spec (owner, 2026-11-15): 48 pt tall, 20 pt side padding,
// 10 pt corners (`rounded-button`), a 15 pt semibold label (`text-button`), an
// 18 pt glyph 8 pt from it. Solid buttons darken while pressed
// (`primary-pressed`) instead of fading; a disabled solid button takes the
// `disabled` fill. Secondary buttons are the soft surface, not a second solid.
//
// Beyond the label: a glyph on either side (`icon`, `iconPosition`), anything
// small before the label (`leading`: an avatar) or after it (`trailing`: a
// count, a badge, a shortcut), and a second line under it (`description`),
// which turns the button into a left-aligned choice.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { ActivityIndicator, type GestureResponderEvent, type NativeSyntheticEvent, Pressable, type TargetedEvent, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

export const buttonVariants = cva("flex-row items-center justify-center gap-2", {
	variants: {
		variant: {
			/** The one solid action: slate in light, white in dark (`primary`), one step deeper while pressed. */
			primary: "active:bg-primary-pressed bg-primary",
			/** A second action beside the solid one: the soft surface (owner, 2026-11-15), the selected fill while pressed. */
			secondary: "active:bg-surface-selected bg-secondary",
			// The lesser action beside a solid one, or a quiet utility: Cancel, Load more, Retry.
			outline: "active:bg-surface-selected border border-input bg-transparent",
			// Destructive buttons stay solid red (owner, 2026-11-15).
			destructive: "bg-destructive active:opacity-80",
			ghost: "active:bg-surface-selected bg-transparent",
			/** Text in the link colour, no fill or border: an action inside running text or a quiet footer. */
			link: "bg-transparent active:opacity-60",
		},
		/**
		 * `md`: a form's or a screen's action. `lg`: a hero's one call to action. `sm`: a compact pill beside other content;
		 * `xs`: a tag-sized control in a dense row. The touch area of both still reaches 44 pt.
		 */
		size: {
			lg: "rounded-button min-h-14 px-6 py-3.5",
			md: "rounded-button min-h-12 px-5 py-3",
			sm: "min-h-9 rounded-full px-3.5 py-1.5",
			xs: "min-h-7 gap-1.5 rounded-full px-2.5 py-1",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "border border-destructive",
		},
	},
	compoundVariants: [
		// A disabled solid button takes the spec's `disabled` fill rather than a faded colour.
		{ variant: ["primary", "destructive"], state: "disabled", className: "bg-disabled opacity-100" },
	],
	defaultVariants: { variant: "primary", size: "md", state: "default" },
});

/** Button labels are the one place Bricolage Grotesque appears (`font-button`, ADR 079). */
export const buttonLabelVariants = cva("shrink font-button", {
	variants: {
		variant: {
			primary: "text-primary-foreground",
			secondary: "text-secondary-foreground",
			outline: "text-foreground",
			destructive: "text-status-foreground",
			ghost: "text-link",
			link: "text-link underline",
		},
		size: { lg: "text-body-lg", md: "text-button", sm: "text-body", xs: "text-caption" },
	},
	defaultVariants: { variant: "primary", size: "md" },
});

/** The spinner's and icon's colour per variant (Uniwind `accent-*` → the native `color` prop). */
const CONTENT_COLOR: Readonly<Record<ButtonVariant, string>> = {
	primary: "accent-primary-foreground",
	secondary: "accent-secondary-foreground",
	outline: "accent-foreground",
	destructive: "accent-status-foreground",
	ghost: "accent-primary",
	link: "accent-link",
};

/** The second line of a two-line button, in its label's colour, quieter. */
export const buttonDescriptionVariants = cva("text-caption font-sans opacity-80", {
	variants: {
		variant: {
			primary: "text-primary-foreground",
			secondary: "text-muted-foreground",
			outline: "text-muted-foreground",
			destructive: "text-status-foreground",
			ghost: "text-muted-foreground",
			link: "text-link",
		},
	},
	defaultVariants: { variant: "primary" },
});

type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type ButtonVariant = NonNullable<ButtonVariantProps["variant"]>;
export type ButtonSize = NonNullable<ButtonVariantProps["size"]>;

/** Extra touch area of a compact button: 36 pt tall plus 4 pt each side is the 44 pt minimum (rules/04). */
const SMALL_HIT_SLOP = 4;
/** And of the smallest: 28 pt tall plus 8 pt each side. */
const EXTRA_SMALL_HIT_SLOP = 8;

const HIT_SLOP: Readonly<Record<ButtonSize, number | undefined>> = { lg: undefined, md: undefined, sm: SMALL_HIT_SLOP, xs: EXTRA_SMALL_HIT_SLOP };

/** Which side of the label the glyph sits on. */
export type ButtonIconPosition = "start" | "end";

export interface ButtonProps {
	readonly label: string;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly variant?: ButtonVariant | undefined;
	readonly size?: ButtonSize | undefined;
	/** A glyph beside the label; decorative — the label names the action. */
	readonly icon?: LucideIcon | undefined;
	/** The glyph before the label (default) or after it (a forward arrow). */
	readonly iconPosition?: ButtonIconPosition | undefined;
	/** Something small before the label (an avatar); decorative — the label names the action. */
	readonly leading?: React.ReactNode | undefined;
	/** Something small after the label (a count, a badge, a shortcut); say it in `accessibilityLabel` when it matters. */
	readonly trailing?: React.ReactNode | undefined;
	/** A second line under the label: the button becomes a left-aligned, two-line choice. */
	readonly description?: string | undefined;
	/** A request is in flight: shows a spinner and blocks presses. */
	readonly loading?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The caller's validation outcome for the action (rare: a submit whose form is invalid). */
	readonly invalid?: boolean | undefined;
	/** A long press (a tooltip explaining the control hands it its own). */
	readonly onLongPress?: (() => void) | undefined;
	/** The finger lifted (a tooltip hides its bubble). */
	readonly onPressOut?: (() => void) | undefined;
	/** What happens on press, for screen readers when the label alone is not enough. */
	readonly accessibilityHint?: string | undefined;
	/** Overrides the accessible name (defaults to `label`). */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the container, merged last (layout: `flex-1`, `self-start`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Button = React.memo(
	React.forwardRef<ViewInstance, ButtonProps>(function Button(
		{
			label,
			onPress,
			onFocus,
			onBlur,
			onLongPress,
			onPressOut,
			variant = "primary",
			size = "md",
			icon,
			iconPosition = "start",
			leading,
			trailing,
			description,
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
				onLongPress={onLongPress}
				onPressOut={onPressOut}
				testID={testID}
				hitSlop={HIT_SLOP[size]}
				className={cn(buttonVariants({ variant, size, state }), description === undefined ? undefined : "justify-start", className)}>
				{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : null}
				{icon === undefined || loading || iconPosition === "end" ? null : <Icon icon={icon} size="sm" colorClassName={contentColor} />}
				{leading}
				{description === undefined ? (
					// One line, always: a button is never taller than its row (the caller gives it the width it needs).
					<Text numberOfLines={1} className={buttonLabelVariants({ variant, size })}>
						{label}
					</Text>
				) : (
					<View className="flex-1 gap-0.5">
						<Text numberOfLines={1} className={buttonLabelVariants({ variant, size })}>
							{label}
						</Text>
						<Text numberOfLines={2} className={buttonDescriptionVariants({ variant })}>
							{description}
						</Text>
					</View>
				)}
				{trailing}
				{icon === undefined || loading || iconPosition === "start" ? null : <Icon icon={icon} size="sm" colorClassName={contentColor} />}
			</Pressable>
		);
	}),
);
