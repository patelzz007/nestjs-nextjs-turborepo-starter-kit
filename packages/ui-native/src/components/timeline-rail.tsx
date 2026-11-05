// A vertical timeline, as GitHub draws a conversation: a line down the left
// with each entry's node on it (an avatar, or a small icon disc), and the
// entry beside it. Presentational and data-agnostic: the caller passes the
// node and the content. As in ReUI's timeline, a connector runs from below
// each node to the next entry: nothing above the first node, nothing after
// the last.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";

export const timelineRailItemVariants = cva("flex-row gap-3", {
	variants: {
		variant: { default: "" },
		size: { md: "", sm: "" },
	},
	defaultVariants: { variant: "default", size: "md" },
});

/**
 * The node column. `align`: `start` puts the node level with the top of the entry (a conversation's
 * avatar beside a comment); `center` centres it on the entry, so the glyph and a list row (its title and
 * the line under it) sit on one line, whatever the row's height.
 */
const timelineRailNodeColumnVariants = cva("w-8 items-center", {
	variants: {
		align: { start: "", center: "justify-center" },
	},
	defaultVariants: { align: "start" },
});

/**
 * The connector, as ReUI's timeline draws it (ADR 079): from just below one node to the next, so nothing
 * shows above the first node and nothing runs on after the last. A centred node has a half above it (to
 * the previous entry) and a half below it (to the next); `hidden` keeps the space but draws nothing.
 */
const timelineRailConnectorVariants = cva("w-0.5 flex-1 rounded-full", {
	variants: {
		side: { above: "mb-1", below: "mt-1" },
		hidden: { true: "bg-transparent", false: "bg-border" },
	},
	defaultVariants: { side: "below", hidden: false },
});

const timelineRailContentVariants = cva("flex-1", {
	variants: {
		size: { md: "pb-5", sm: "pb-3" },
		compact: { true: "min-h-8 justify-center", false: "" },
		isLast: { true: "pb-0", false: "" },
		/** A centred node's entry is a list row that pads itself: no room below it, or the node would sit off centre. */
		align: { start: "", center: "pb-0" },
	},
	defaultVariants: { size: "md", compact: false, isLast: false, align: "start" },
});

type TimelineRailItemVariantProps = VariantProps<typeof timelineRailItemVariants>;
export type TimelineRailAlign = NonNullable<VariantProps<typeof timelineRailNodeColumnVariants>["align"]>;
export type TimelineRailItemVariant = NonNullable<TimelineRailItemVariantProps["variant"]>;
export type TimelineRailSize = NonNullable<TimelineRailItemVariantProps["size"]>;

export interface TimelineRailItemProps {
	/** What sits on the line: `<TimelineRailIcon />` or an avatar. */
	readonly node: React.ReactNode;
	readonly children: React.ReactNode;
	/** The first entry: with a centred node, no connector above it. */
	readonly isFirst?: boolean;
	/** The final entry: no connector below its node. */
	readonly isLast?: boolean;
	/** A one-line entry (an event): its text centres on the node instead of starting at its top. */
	readonly compact?: boolean;
	/** Where the node sits: level with the entry's top (`start`), or centred on it (`center`, for list rows). */
	readonly align?: TimelineRailAlign;
	readonly variant?: TimelineRailItemVariant;
	/** The room below each entry: `sm` for dense lists. */
	readonly size?: TimelineRailSize;
	/** Extra classes for the row, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const TimelineRailItem = React.memo(
	React.forwardRef<ViewInstance, TimelineRailItemProps>(function TimelineRailItem(
		{ node, children, isFirst = false, isLast = false, compact = false, align = "start", variant = "default", size = "md", className, testID },
		ref,
	): React.JSX.Element {
		return (
			<View ref={ref} className={cn(timelineRailItemVariants({ variant, size }), className)} testID={testID}>
				{/* Width of the node column: the node, then the connector down its middle to the next entry. */}
				<View className={timelineRailNodeColumnVariants({ align })} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
					{align === "center" ? (
						<View className={timelineRailConnectorVariants({ side: "above", hidden: isFirst })} testID={testID === undefined ? undefined : `${testID}-connector-above`} />
					) : null}
					{node}
					{align === "center" ? (
						<View className={timelineRailConnectorVariants({ side: "below", hidden: isLast })} testID={testID === undefined ? undefined : `${testID}-connector`} />
					) : isLast ? null : (
						<View className={timelineRailConnectorVariants()} testID={testID === undefined ? undefined : `${testID}-connector`} />
					)}
				</View>
				<View testID={testID === undefined ? undefined : `${testID}-content`} className={cn(timelineRailContentVariants({ size, compact, isLast, align }))}>
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

/** A small disc on the rail holding an event's glyph. Decorative: the entry beside it says what happened. */
export const TimelineRailIcon = React.memo(
	React.forwardRef<ViewInstance, TimelineRailIconProps>(function TimelineRailIcon({ icon, tone = "neutral", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(timelineRailIconVariants({ variant: tone, size }), className)} testID={testID}>
				<Icon icon={icon} size="sm" colorClassName={GLYPH_COLOR[tone]} />
			</View>
		);
	}),
);
