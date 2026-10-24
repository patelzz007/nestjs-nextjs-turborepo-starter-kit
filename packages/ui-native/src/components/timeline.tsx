// Events in time order ("your recent visits"): one row per event on a rail —
// a dot per event joined by a hairline — with its title, when and what it
// was, its value, and an optional status badge. Each row is read by screen
// readers as one sentence.
//
// Presentational: the caller orders the events (newest first, usually) and
// writes every label.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Badge, type BadgeTone } from "./badge";

export interface TimelineItem {
	readonly key: string;
	readonly title: string;
	/** When, and anything else ("Sat, 10 Oct · 7:42 pm · Café"). */
	readonly detail: string;
	/** The event's amount ("RM 14.50"). */
	readonly value: string;
	readonly badge?: { readonly label: string; readonly tone: BadgeTone };
}

export const timelineVariants = cva("", {
	variants: {
		/** `default`: the primary-ringed dot. `muted`: a quiet grey dot, for history that is not the screen's focus. */
		variant: { default: "", muted: "" },
		size: { md: "", sm: "" },
	},
	defaultVariants: { variant: "default", size: "md" },
});

export const timelineDotVariants = cva("mt-1.5 size-2.5 rounded-full border-2 bg-card", {
	variants: {
		variant: { default: "border-primary", muted: "border-muted-foreground" },
	},
	defaultVariants: { variant: "default" },
});

export const timelineEntryVariants = cva("flex-1 gap-1", {
	variants: {
		size: { md: "pb-4", sm: "pb-2" },
	},
	defaultVariants: { size: "md" },
});

const TITLE_SIZE: Readonly<Record<TimelineSize, string>> = { md: "text-sm", sm: "text-xs" };

type TimelineVariantProps = VariantProps<typeof timelineVariants>;
export type TimelineVariant = NonNullable<TimelineVariantProps["variant"]>;
export type TimelineSize = NonNullable<TimelineVariantProps["size"]>;

export interface TimelineProps {
	readonly items: readonly TimelineItem[];
	readonly variant?: TimelineVariant;
	readonly size?: TimelineSize;
	/** Extra classes for the container, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

/** "Kopi Kaki, RM 14.50, Sat, 10 Oct · 7:42 pm, Reward redeemed". */
export function describeTimelineItem(item: TimelineItem): string {
	const parts = [item.title, item.value, item.detail];
	return item.badge === undefined ? parts.join(", ") : [...parts, item.badge.label].join(", ");
}

export const Timeline = React.memo(
	React.forwardRef<ViewInstance, TimelineProps>(function Timeline({ items, variant = "default", size = "md", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} className={cn(timelineVariants({ variant, size }), className)} testID={testID}>
				{items.map((item: TimelineItem, index: number): React.JSX.Element => (
					<TimelineEntry key={item.key} item={item} isLast={index === items.length - 1} variant={variant} size={size} />
				))}
			</View>
		);
	}),
);

interface TimelineEntryProps {
	readonly item: TimelineItem;
	readonly isLast: boolean;
	readonly variant: TimelineVariant;
	readonly size: TimelineSize;
}

const TimelineEntry = React.memo(function TimelineEntry({ item, isLast, variant, size }: TimelineEntryProps): React.JSX.Element {
	return (
		<View className="flex-row gap-3" accessible accessibilityLabel={describeTimelineItem(item)}>
			<View className="w-3 items-center">
				<View className={timelineDotVariants({ variant })} />
				{isLast ? null : <View className="w-px flex-1 bg-border" />}
			</View>
			<View className={timelineEntryVariants({ size })}>
				<View className="flex-row items-baseline gap-3">
					<Text className={cn("font-sans-medium flex-1 text-foreground", TITLE_SIZE[size])} numberOfLines={1}>
						{item.title}
					</Text>
					<Text className={cn("font-sans-semibold text-foreground", TITLE_SIZE[size])}>{item.value}</Text>
				</View>
				<Text className="font-sans text-xs text-muted-foreground">{item.detail}</Text>
				{item.badge === undefined ? null : <Badge label={item.badge.label} tone={item.badge.tone} />}
			</View>
		</View>
	);
});
