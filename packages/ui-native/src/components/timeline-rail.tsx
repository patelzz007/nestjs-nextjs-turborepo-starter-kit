// A vertical timeline, as GitHub draws a conversation: a line down the left
// with each entry's node on it (an avatar, or a small icon disc), and the
// entry beside it. Presentational and data-agnostic: the caller passes the
// node and the content. Rows sit flush so the line runs unbroken from one
// entry to the next; the last entry's line stops at its node.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const timelineRailItemVariants = cva("flex-row gap-3", {
	variants: {
		variant: { default: "" },
		size: { md: "", sm: "" },
	},
	defaultVariants: { variant: "default", size: "md" },
});

/** The line down the node column; the last entry's stops at its node. */
const timelineRailLineVariants = cva("absolute top-0 w-0.5 bg-border", {
	variants: {
		isLast: { true: "h-4", false: "bottom-0" },
	},
	defaultVariants: { isLast: false },
});

const timelineRailContentVariants = cva("flex-1", {
	variants: {
		size: { md: "pb-5", sm: "pb-3" },
		compact: { true: "min-h-8 justify-center", false: "" },
		isLast: { true: "pb-0", false: "" },
	},
	defaultVariants: { size: "md", compact: false, isLast: false },
});

type TimelineRailItemVariantProps = VariantProps<typeof timelineRailItemVariants>;
export type TimelineRailItemVariant = NonNullable<TimelineRailItemVariantProps["variant"]>;
export type TimelineRailSize = NonNullable<TimelineRailItemVariantProps["size"]>;

export interface TimelineRailItemProps {
	/** What sits on the line: `<TimelineRailIcon />` or an avatar. */
	readonly node: React.ReactNode;
	readonly children: React.ReactNode;
	/** The final entry: the line ends at its node instead of running on. */
	readonly isLast?: boolean;
	/** A one-line entry (an event): its text centres on the node instead of starting at its top. */
	readonly compact?: boolean;
	readonly variant?: TimelineRailItemVariant;
	/** The room below each entry: `sm` for dense lists. */
	readonly size?: TimelineRailSize;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const TimelineRailItem = React.memo(
	React.forwardRef<View, TimelineRailItemProps>(function TimelineRailItem(
		{ node, children, isLast = false, compact = false, variant = "default", size = "md", className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} className={cn(timelineRailItemVariants({ variant, size }), className)} testID={testID}>
				{/* Width of the node column; the line runs down its middle. */}
				<View className="w-8 items-center" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
					<View className={timelineRailLineVariants({ isLast })} />
					{node}
				</View>
				<View testID={testID === undefined ? undefined : `${testID}-content`} className={cn(timelineRailContentVariants({ size, compact, isLast }))}>
					{children}
				</View>
			</View>
		);
	}),
);

export type TimelineRailTone = "neutral" | "success" | "danger" | "attention" | "done";

/** Fill per tone — design tokens only (ADR 030). The tone is the CVA `variant` axis. */
export const timelineRailIconVariants = cva("items-center justify-center rounded-full", {
	variants: {
		variant: {
			neutral: "border border-border bg-muted",
			success: "bg-success",
			danger: "bg-destructive",
			attention: "bg-warning-soft",
			done: "bg-tone-violet",
		},
		size: { md: "size-8", sm: "size-6" },
	},
	defaultVariants: { variant: "neutral", size: "md" },
});

/** The glyph's colour per tone (Uniwind `accent-*`). */
const GLYPH_COLOR: Readonly<Record<TimelineRailTone, string>> = {
	neutral: "accent-muted-foreground",
	success: "accent-status-foreground",
	danger: "accent-status-foreground",
	attention: "accent-warning-foreground",
	done: "accent-status-foreground",
};

export type TimelineRailIconSize = NonNullable<VariantProps<typeof timelineRailIconVariants>["size"]>;

export interface TimelineRailIconProps {
	readonly icon: LucideIcon;
	readonly tone?: TimelineRailTone;
	readonly size?: TimelineRailIconSize;
	/** Extra classes for the disc, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** A small disc on the line holding an event's glyph; it covers the line behind it. Decorative: the entry beside it says what happened. */
export const TimelineRailIcon = React.memo(
	React.forwardRef<View, TimelineRailIconProps>(function TimelineRailIcon({ icon, tone = "neutral", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(timelineRailIconVariants({ variant: tone, size }), className)} testID={testID}>
				<Icon icon={icon} size="sm" colorClassName={GLYPH_COLOR[tone]} />
			</View>
		);
	}),
);
