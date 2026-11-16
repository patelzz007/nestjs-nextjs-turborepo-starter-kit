// A short label ("This device", "On", "Sample data"). Presentational: the
// caller picks the words and the tone. `tone` is what the label is about,
// `variant` how loudly it says it: `soft` (a tinted fill, the default),
// `light` (a tinted fill with a matching faint border), `solid` (a
// full-strength fill) or `outline` (a bordered card surface, the label in the
// tone's colour). For a status that changes over time (online, failed) use
// StatusBadge.
//
// A badge can lead with a glyph, a status dot, or an avatar or flag
// (`leading`); end in a remove button (`onRemove`, a removable filter); and
// be a link (`onPress`). Sizes `sm`, `md`, `lg`; a pill or a rounded square.

import { cva, type VariantProps } from "class-variance-authority";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const badgeVariants = cva("flex-row items-center self-start border", {
	variants: {
		variant: { soft: "border-transparent", light: "", solid: "border-transparent", outline: "border-border bg-card" },
		tone: { neutral: "", primary: "", info: "", success: "", warning: "", destructive: "" },
		size: { sm: "gap-1 px-2 py-px", md: "gap-1 px-2.5 py-0.5", lg: "gap-1.5 px-3 py-1" },
		/** `pill` (default) or a rounded square. */
		shape: { pill: "rounded-full", rounded: "rounded-md" },
	},
	compoundVariants: [
		{ variant: ["soft", "light"], tone: "neutral", className: "bg-muted" },
		{ variant: ["soft", "light"], tone: "primary", className: "bg-primary/10" },
		{ variant: ["soft", "light"], tone: "info", className: "bg-info-soft" },
		{ variant: ["soft", "light"], tone: "success", className: "bg-success-soft" },
		{ variant: ["soft", "light"], tone: "warning", className: "bg-warning-soft" },
		{ variant: ["soft", "light"], tone: "destructive", className: "bg-destructive-soft" },
		{ variant: "light", tone: "neutral", className: "border-border" },
		{ variant: "light", tone: "primary", className: "border-primary/25" },
		{ variant: "light", tone: "info", className: "border-info/25" },
		{ variant: "light", tone: "success", className: "border-success/25" },
		{ variant: "light", tone: "warning", className: "border-warning/25" },
		{ variant: "light", tone: "destructive", className: "border-destructive/25" },
		{ variant: "solid", tone: "neutral", className: "bg-invert" },
		{ variant: "solid", tone: "primary", className: "bg-primary" },
		{ variant: "solid", tone: "info", className: "bg-info" },
		{ variant: "solid", tone: "success", className: "bg-success" },
		{ variant: "solid", tone: "warning", className: "bg-warning" },
		{ variant: "solid", tone: "destructive", className: "bg-destructive" },
	],
	defaultVariants: { variant: "soft", tone: "neutral", size: "md", shape: "pill" },
});

export const badgeLabelVariants = cva("font-sans-medium", {
	variants: {
		variant: { soft: "", light: "", solid: "", outline: "" },
		tone: { neutral: "", primary: "", info: "", success: "", warning: "", destructive: "" },
		size: { sm: "text-overline", md: "text-caption", lg: "text-body" },
	},
	compoundVariants: [
		{ variant: ["soft", "light"], tone: "neutral", className: "text-muted-foreground" },
		{ variant: "outline", tone: "neutral", className: "text-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "primary", className: "text-primary" },
		{ variant: ["soft", "light", "outline"], tone: "info", className: "text-info-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "success", className: "text-success-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "warning", className: "text-warning-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "destructive", className: "text-destructive-foreground" },
		{ variant: "solid", tone: "neutral", className: "text-invert-foreground" },
		{ variant: "solid", tone: "primary", className: "text-primary-foreground" },
		{ variant: "solid", tone: ["info", "success", "warning", "destructive"], className: "text-status-foreground" },
	],
	defaultVariants: { variant: "soft", tone: "neutral", size: "md" },
});

/** The icon's colour: the label's, as an `accent-*` utility. */
export const badgeIconVariants = cva("", {
	variants: {
		variant: { soft: "", light: "", solid: "", outline: "" },
		tone: { neutral: "", primary: "", info: "", success: "", warning: "", destructive: "" },
	},
	compoundVariants: [
		{ variant: ["soft", "light"], tone: "neutral", className: "accent-muted-foreground" },
		{ variant: "outline", tone: "neutral", className: "accent-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "primary", className: "accent-primary" },
		{ variant: ["soft", "light", "outline"], tone: "info", className: "accent-info-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "success", className: "accent-success-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "warning", className: "accent-warning-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "destructive", className: "accent-destructive-foreground" },
		{ variant: "solid", tone: "neutral", className: "accent-invert-foreground" },
		{ variant: "solid", tone: "primary", className: "accent-primary-foreground" },
		{ variant: "solid", tone: ["info", "success", "warning", "destructive"], className: "accent-status-foreground" },
	],
	defaultVariants: { variant: "soft", tone: "neutral" },
});

/** The status dot: the label's colour, as a fill. */
export const badgeDotVariants = cva("size-1.5 rounded-full", {
	variants: {
		variant: { soft: "", light: "", solid: "", outline: "" },
		tone: { neutral: "", primary: "", info: "", success: "", warning: "", destructive: "" },
	},
	compoundVariants: [
		{ variant: ["soft", "light"], tone: "neutral", className: "bg-muted-foreground" },
		{ variant: "outline", tone: "neutral", className: "bg-foreground" },
		{ variant: ["soft", "light", "outline"], tone: "primary", className: "bg-primary" },
		{ variant: ["soft", "light", "outline"], tone: "info", className: "bg-info" },
		{ variant: ["soft", "light", "outline"], tone: "success", className: "bg-success" },
		{ variant: ["soft", "light", "outline"], tone: "warning", className: "bg-warning" },
		{ variant: ["soft", "light", "outline"], tone: "destructive", className: "bg-destructive" },
		{ variant: "solid", tone: "neutral", className: "bg-invert-foreground" },
		{ variant: "solid", tone: "primary", className: "bg-primary-foreground" },
		{ variant: "solid", tone: ["info", "success", "warning", "destructive"], className: "bg-status-foreground" },
	],
	defaultVariants: { variant: "soft", tone: "neutral" },
});

type BadgeVariantProps = VariantProps<typeof badgeVariants>;
export type BadgeVariant = NonNullable<BadgeVariantProps["variant"]>;
export type BadgeTone = NonNullable<BadgeVariantProps["tone"]>;
export type BadgeSize = NonNullable<BadgeVariantProps["size"]>;
export type BadgeShape = NonNullable<BadgeVariantProps["shape"]>;

/** The remove button's extra touch area around its 16 pt glyph, to reach 44 pt (rules/04). */
const REMOVE_HIT_SLOP = 14;

export interface BadgeProps {
	readonly label: string;
	readonly tone?: BadgeTone | undefined;
	readonly variant?: BadgeVariant | undefined;
	readonly size?: BadgeSize | undefined;
	readonly shape?: BadgeShape | undefined;
	/** A glyph before the label; decorative — the label says what it means. */
	readonly icon?: LucideIcon | undefined;
	/** A status dot before the label, in its colour. */
	readonly dot?: boolean | undefined;
	/** Before the label: a small avatar, a flag. Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** Ends the badge in a remove button (a removable filter). */
	readonly onRemove?: (() => void) | undefined;
	/** The remove button's name. Default "Remove <label>". */
	readonly removeLabel?: string | undefined;
	/** The whole badge is a link. */
	readonly onPress?: (() => void) | undefined;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Badge = React.memo(
	React.forwardRef<ViewInstance, BadgeProps>(function Badge(
		{ label, tone = "neutral", variant = "soft", size = "md", shape = "pill", icon, dot = false, leading, onRemove, removeLabel, onPress, className, testID },
		ref,
	): React.JSX.Element {
		const body = (
			<>
				{dot ? <View className={badgeDotVariants({ variant, tone })} /> : null}
				{leading ?? null}
				{icon === undefined ? null : <Icon icon={icon} size={size === "sm" ? "xs" : "sm"} colorClassName={badgeIconVariants({ variant, tone })} />}
				<Text numberOfLines={1} className={badgeLabelVariants({ variant, tone, size })}>
					{label}
				</Text>
				{onRemove === undefined ? null : (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={removeLabel ?? `Remove ${label}`}
						onPress={onRemove}
						hitSlop={REMOVE_HIT_SLOP}
						className="active:opacity-60">
						<Icon icon={XIcon} size="xs" colorClassName={badgeIconVariants({ variant, tone })} />
					</Pressable>
				)}
			</>
		);
		const classes = cn(badgeVariants({ variant, tone, size, shape }), className);
		if (onPress !== undefined) {
			return (
				<Pressable ref={ref} accessibilityRole="link" accessibilityLabel={label} onPress={onPress} testID={testID} className={cn(classes, "active:opacity-70")}>
					{body}
				</Pressable>
			);
		}
		return (
			<View ref={ref} testID={testID} className={classes}>
				{body}
			</View>
		);
	}),
);
