// A message block: a request error, a notice, a success. Errors are announced
// to screen readers as alerts (assertively); other tones as summaries
// (politely). Presentational: the caller passes the words, an optional title
// and glyph (or a leading avatar), richer content (a checklist), any actions
// as children, and an optional close button. Tones: neutral, info, success,
// warning, error, and invert (a dark bar); `flush` drops the card's radius and
// border to fill a framed panel.

import { cva, type VariantProps } from "class-variance-authority";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";
import { BodyText } from "./text";

export const alertVariants = cva("flex-row gap-3 px-4 py-3.5", {
	variants: {
		tone: {
			neutral: "border-border bg-card",
			error: "border-destructive/25 bg-destructive-soft",
			info: "border-info/25 bg-info-soft",
			success: "border-success/25 bg-success-soft",
			warning: "border-warning/25 bg-warning-soft",
			invert: "border-invert bg-invert",
		},
		/** `card` (default): rounded and bordered. `flush`: neither, to fill a framed panel edge to edge. */
		variant: { card: "rounded-card border", flush: "" },
	},
	defaultVariants: { tone: "info", variant: "card" },
});

/** The title's and message's colour per tone. */
export const alertTextVariants = cva("", {
	variants: {
		tone: {
			neutral: "text-foreground",
			error: "text-destructive-foreground",
			info: "text-info-foreground",
			success: "text-success-foreground",
			warning: "text-warning-foreground",
			invert: "text-invert-foreground",
		},
	},
	defaultVariants: { tone: "info" },
});

/** The glyph's colour per tone (Uniwind `accent-*` → the icon's `color`). */
export const alertIconVariants = cva("", {
	variants: {
		tone: {
			neutral: "accent-foreground",
			error: "accent-destructive-foreground",
			info: "accent-info-foreground",
			success: "accent-success-foreground",
			warning: "accent-warning-foreground",
			invert: "accent-invert-foreground",
		},
	},
	defaultVariants: { tone: "info" },
});

export type AlertTone = NonNullable<VariantProps<typeof alertVariants>["tone"]>;

export type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

/** The close button's extra touch area around its 32 pt circle, to reach 44 pt (rules/04). */
const DISMISS_HIT_SLOP = 6;

export interface AlertProps {
	readonly tone: AlertTone;
	/** The message; leave it out for a title-only alert. */
	readonly message?: string | undefined;
	/** A short heading above the message ("Payment failed"). */
	readonly title?: string | undefined;
	/** A glyph before the text; decorative — the words carry the meaning. */
	readonly icon?: LucideIcon | undefined;
	/** The glyph's colour, in place of the tone's (`accent-warning` for a bolt on a dark bar). */
	readonly iconColorClassName?: string | undefined;
	/** Before the text, in place of the glyph: an avatar. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** Under the message: a checklist, a quoted preview. */
	readonly content?: React.ReactNode | undefined;
	/** Actions under the message (a retry button). */
	readonly children?: React.ReactNode;
	/** Shows a close button in the corner; called when it is pressed. */
	readonly onDismiss?: (() => void) | undefined;
	readonly dismissLabel?: string | undefined;
	readonly variant?: AlertVariant | undefined;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Alert = React.memo(
	React.forwardRef<ViewInstance, AlertProps>(function Alert(
		{ tone, message, title, icon, iconColorClassName, leading, content, children, onDismiss, dismissLabel = "Dismiss", variant = "card", className, testID },
		ref,
	): React.JSX.Element {
		const isError = tone === "error";
		const textClassName = alertTextVariants({ tone });
		// One read-out for screen readers, unless it holds controls (actions, a close button) or rich content.
		const isOneReadOut = children === undefined && onDismiss === undefined && content === undefined;
		const mutedClassName = tone === "neutral" ? "text-muted-foreground" : tone === "invert" ? "text-invert-foreground/80" : textClassName;
		return (
			<View
				ref={ref}
				accessible={isOneReadOut}
				accessibilityRole={isError ? "alert" : "summary"}
				accessibilityLiveRegion={isError ? "assertive" : "polite"}
				testID={testID}
				className={cn(alertVariants({ tone, variant }), className)}>
				{leading ?? (icon === undefined ? null : <Icon icon={icon} size="md" colorClassName={iconColorClassName ?? alertIconVariants({ tone })} />)}
				<View className="flex-1 gap-1">
					{title === undefined ? null : <Text className={cn("font-sans-semibold text-body-lg", textClassName)}>{title}</Text>}
					{message === undefined ? null : <BodyText className={title === undefined ? textClassName : mutedClassName}>{message}</BodyText>}
					{content ?? null}
					{children === undefined ? null : <View className="mt-2 flex-row flex-wrap gap-2">{children}</View>}
				</View>
				{onDismiss === undefined ? null : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={dismissLabel}
						onPress={onDismiss}
						hitSlop={DISMISS_HIT_SLOP}
						className="-mt-1 -mr-1 size-8 items-center justify-center rounded-full active:opacity-60">
						<Icon icon={XIcon} size="sm" colorClassName={alertIconVariants({ tone })} />
					</Pressable>
				)}
			</View>
		);
	}),
);
