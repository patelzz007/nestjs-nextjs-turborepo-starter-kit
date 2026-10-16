// A short label ("This device", "On", "Sample data"). Presentational: the
// caller picks the words and the tone. `tone` is what the label is about,
// `variant` how loudly it says it: `soft` (a tinted fill, the default),
// `solid` (a full-strength fill) or `outline` (a bordered card surface). For a
// status that changes over time (online, failed) use StatusBadge.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const badgeVariants = cva("flex-row items-center self-start rounded-full border", {
	variants: {
		variant: { soft: "border-transparent", solid: "border-transparent", outline: "border-border bg-card" },
		tone: { neutral: "", info: "", success: "", warning: "", destructive: "" },
		size: { sm: "gap-1 px-2 py-px", md: "gap-1 px-2.5 py-0.5" },
	},
	compoundVariants: [
		{ variant: "soft", tone: "neutral", className: "border-border bg-muted" },
		{ variant: "soft", tone: "info", className: "bg-info-soft" },
		{ variant: "soft", tone: "success", className: "bg-success-soft" },
		{ variant: "soft", tone: "warning", className: "bg-warning-soft" },
		{ variant: "soft", tone: "destructive", className: "bg-destructive-soft" },
		{ variant: "solid", tone: "neutral", className: "bg-invert" },
		{ variant: "solid", tone: "info", className: "bg-info" },
		{ variant: "solid", tone: "success", className: "bg-success" },
		{ variant: "solid", tone: "warning", className: "bg-warning" },
		{ variant: "solid", tone: "destructive", className: "bg-destructive" },
	],
	defaultVariants: { variant: "soft", tone: "neutral", size: "md" },
});

export const badgeLabelVariants = cva("font-sans-medium", {
	variants: {
		variant: { soft: "", solid: "", outline: "" },
		tone: { neutral: "", info: "", success: "", warning: "", destructive: "" },
		size: { sm: "text-badge-sm", md: "text-xs" },
	},
	compoundVariants: [
		{ variant: "soft", tone: "neutral", className: "text-muted-foreground" },
		{ variant: "outline", tone: "neutral", className: "text-foreground" },
		{ variant: ["soft", "outline"], tone: "info", className: "text-info-foreground" },
		{ variant: ["soft", "outline"], tone: "success", className: "text-success-foreground" },
		{ variant: ["soft", "outline"], tone: "warning", className: "text-warning-foreground" },
		{ variant: ["soft", "outline"], tone: "destructive", className: "text-destructive-foreground" },
		{ variant: "solid", tone: "neutral", className: "text-invert-foreground" },
		{ variant: "solid", tone: ["info", "success", "warning", "destructive"], className: "text-status-foreground" },
	],
	defaultVariants: { variant: "soft", tone: "neutral", size: "md" },
});

/** The icon's colour: the label's, as an `accent-*` utility. */
export const badgeIconVariants = cva("", {
	variants: {
		variant: { soft: "", solid: "", outline: "" },
		tone: { neutral: "", info: "", success: "", warning: "", destructive: "" },
	},
	compoundVariants: [
		{ variant: "soft", tone: "neutral", className: "accent-muted-foreground" },
		{ variant: "outline", tone: "neutral", className: "accent-foreground" },
		{ variant: ["soft", "outline"], tone: "info", className: "accent-info-foreground" },
		{ variant: ["soft", "outline"], tone: "success", className: "accent-success-foreground" },
		{ variant: ["soft", "outline"], tone: "warning", className: "accent-warning-foreground" },
		{ variant: ["soft", "outline"], tone: "destructive", className: "accent-destructive-foreground" },
		{ variant: "solid", tone: "neutral", className: "accent-invert-foreground" },
		{ variant: "solid", tone: ["info", "success", "warning", "destructive"], className: "accent-status-foreground" },
	],
	defaultVariants: { variant: "soft", tone: "neutral" },
});

type BadgeVariantProps = VariantProps<typeof badgeVariants>;
export type BadgeVariant = NonNullable<BadgeVariantProps["variant"]>;
export type BadgeTone = NonNullable<BadgeVariantProps["tone"]>;
export type BadgeSize = NonNullable<BadgeVariantProps["size"]>;

export interface BadgeProps {
	readonly label: string;
	readonly tone?: BadgeTone;
	readonly variant?: BadgeVariant;
	readonly size?: BadgeSize;
	/** A glyph before the label; decorative — the label says what it means. */
	readonly icon?: LucideIcon;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const Badge = React.memo(
	React.forwardRef<View, BadgeProps>(function Badge({ label, tone = "neutral", variant = "soft", size = "md", icon, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} testID={testID} className={cn(badgeVariants({ variant, tone, size }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="sm" colorClassName={badgeIconVariants({ variant, tone })} />}
				<Text numberOfLines={1} className={badgeLabelVariants({ variant, tone, size })}>
					{label}
				</Text>
			</View>
		);
	}),
);
