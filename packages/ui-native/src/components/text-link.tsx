// An inline link to another screen ("Forgot password?", "Create one"), with an
// optional lead-in sentence before it ("Don't have an account?"). Presentational:
// the caller says what it does. Announced as a link — or as a button when it
// acts in place ("Sign out") rather than going somewhere. The touch area is at
// least 44 pt tall even though the text is small. The ref reaches the
// pressable link; `className` lays out the whole row.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type GestureResponderEvent, type NativeSyntheticEvent, type TargetedEvent } from "react-native";

import { cn } from "../lib/cn";
import { isInactiveState, resolveControlState } from "../lib/control-state";

export const textLinkVariants = cva("font-sans-semibold", {
	variants: {
		/** `primary`: the brand-coloured link. `muted`: a quieter one beside other secondary text. `destructive`: an in-place action that removes something. */
		variant: {
			primary: "text-primary",
			muted: "text-muted-foreground underline",
			destructive: "text-destructive-foreground",
		},
		size: {
			sm: "text-sm",
			md: "text-base",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-60",
			error: "text-destructive-foreground",
		},
	},
	defaultVariants: { variant: "primary", size: "sm", state: "default" },
});

export const textLinkLeadInVariants = cva("font-sans text-muted-foreground", {
	variants: {
		size: {
			sm: "text-sm",
			md: "text-base",
		},
	},
	defaultVariants: { size: "sm" },
});

type TextLinkVariantProps = VariantProps<typeof textLinkVariants>;
export type TextLinkVariant = NonNullable<TextLinkVariantProps["variant"]>;
export type TextLinkSize = NonNullable<TextLinkVariantProps["size"]>;

/** Extra touch area around the small text, so the link reaches 44 pt (rules/04). */
const LINK_HIT_SLOP = 8;

export interface TextLinkProps {
	readonly label: string;
	readonly onPress: (event: GestureResponderEvent) => void;
	readonly onFocus?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	readonly onBlur?: ((event: NativeSyntheticEvent<TargetedEvent>) => void) | undefined;
	/** Plain text shown before the link, on the same line. */
	readonly leadIn?: string | undefined;
	/** `button` when it acts instead of navigating. */
	readonly role?: "link" | "button" | undefined;
	readonly variant?: TextLinkVariant | undefined;
	readonly size?: TextLinkSize | undefined;
	readonly disabled?: boolean | undefined;
	/** The action is in flight: presses are blocked and it is announced busy. */
	readonly loading?: boolean | undefined;
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the row, merged last (layout: `justify-start`, `mt-2`). */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const TextLink = React.memo(
	React.forwardRef<View, TextLinkProps>(function TextLink(
		{ label, onPress, onFocus, onBlur, leadIn, role = "link", variant = "primary", size = "sm", disabled = false, loading = false, accessibilityHint, className, testID },
		ref,
	): React.JSX.Element {
		const state = resolveControlState({ disabled, loading });
		const isInactive = isInactiveState(state);
		const accessibilityState = React.useMemo(() => ({ disabled: isInactive, busy: loading }), [isInactive, loading]);
		return (
			<View className={cn("flex-row flex-wrap items-center justify-center gap-1", className)}>
				{leadIn === undefined ? null : <Text className={textLinkLeadInVariants({ size })}>{leadIn}</Text>}
				<Pressable
					ref={ref}
					accessibilityRole={role}
					accessibilityLabel={label}
					accessibilityHint={accessibilityHint}
					accessibilityState={accessibilityState}
					disabled={isInactive}
					onPress={onPress}
					onFocus={onFocus}
					onBlur={onBlur}
					hitSlop={LINK_HIT_SLOP}
					testID={testID}
					className="min-h-11 justify-center active:opacity-60">
					<Text className={textLinkVariants({ variant, size, state })}>{label}</Text>
				</Pressable>
			</View>
		);
	}),
);
