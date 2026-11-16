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
import { Icon, type IconSize, type LucideIcon } from "./icon";

export const iconButtonVariants = cva("items-center justify-center", {
	variants: {
		/**
		 * `secondary`: the outlined look of a secondary button (the default). `primary`: filled. `ghost`: the glyph alone.
		 * Pressed, the solid one darkens (`primary-pressed`) and the others take the selected fill.
		 */
		variant: {
			secondary: "active:bg-surface-selected border border-border bg-card",
			primary: "active:border-primary-pressed active:bg-primary-pressed border border-primary bg-primary",
			ghost: "active:bg-surface-selected border border-transparent bg-transparent",
		},
		/**
		 * `md`: 44 × 44 pt (the mobile visual spec). `lg`: 56 pt, a media control's main button. `sm`: 36 pt beside dense
		 * content and `xs`: 28 pt on a chip or a toast; the touch area of both still reaches 44 pt.
		 */
		size: {
			lg: "rounded-button size-14",
			md: "rounded-button size-11",
			sm: "size-9 rounded-md",
			xs: "size-7 rounded-md",
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
/** And of the smallest: 28 pt plus 8 pt each side. */
const EXTRA_SMALL_HIT_SLOP = 8;

/** The glyph's size per button size. */
const GLYPH_SIZE: Readonly<Record<IconButtonSize, IconSize>> = { lg: "lg", md: "md", sm: "sm", xs: "sm" };

const HIT_SLOP: Readonly<Record<IconButtonSize, number | undefined>> = { lg: undefined, md: undefined, sm: SMALL_HIT_SLOP, xs: EXTRA_SMALL_HIT_SLOP };

export interface IconButtonProps {
	readonly icon: LucideIcon;
	/** The accessible name — what the button does ("Add a picture"). */
	readonly label: string;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly variant?: IconButtonVariant | undefined;
	readonly size?: IconButtonSize | undefined;
	/** Work is in flight: a spinner in place of the glyph, and presses are blocked. */
	readonly loading?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** The caller's validation outcome for the action (rare). */
	readonly invalid?: boolean | undefined;
	/** A long press (a tooltip explaining the control hands it its own). */
	readonly onLongPress?: (() => void) | undefined;
	/** The finger lifted (a tooltip hides its bubble). */
	readonly onPressOut?: (() => void) | undefined;
	readonly accessibilityHint?: string | undefined;
	/** The glyph's colour (an `accent-*` token) in place of the variant's: a brand's or a category's tone. */
	readonly glyphClassName?: string | undefined;
	/** Extra classes for the button, merged last (layout: `self-end`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const IconButton = React.memo(
	React.forwardRef<ViewInstance, IconButtonProps>(function IconButton(
		{
			icon,
			label,
			onPress,
			onLongPress,
			onPressOut,
			onFocus,
			onBlur,
			variant = "secondary",
			size = "md",
			loading = false,
			disabled = false,
			invalid = false,
			accessibilityHint,
			glyphClassName,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading, invalid });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		const contentColor = glyphClassName ?? CONTENT_COLOR[variant];
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
				onLongPress={onLongPress}
				onPressOut={onPressOut}
				testID={testID}
				hitSlop={HIT_SLOP[size]}
				className={cn(iconButtonVariants({ variant, size, state }), className)}>
				{loading ? <ActivityIndicator size="small" colorClassName={contentColor} /> : <Icon icon={icon} size={GLYPH_SIZE[size]} colorClassName={contentColor} />}
			</Pressable>
		);
	}),
);
