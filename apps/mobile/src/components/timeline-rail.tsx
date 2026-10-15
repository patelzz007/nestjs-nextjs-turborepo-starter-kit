// A vertical timeline, as GitHub draws a conversation: a line down the left
// with each entry's node on it (an avatar, or a small icon disc), and the
// entry beside it. Presentational and data-agnostic: the caller passes the
// node and the content. Rows sit flush so the line runs unbroken from one
// entry to the next; the last entry's line stops at its node.

import * as React from "react";
import { View } from "react-native";

import { Icon, type LucideIcon } from "./icon";

export interface TimelineRailItemProps {
	/** What sits on the line: `<TimelineRailIcon />` or an avatar. */
	readonly node: React.ReactNode;
	readonly children: React.ReactNode;
	/** The final entry: the line ends at its node instead of running on. */
	readonly isLast?: boolean;
	/** A one-line entry (an event): its text centres on the node instead of starting at its top. */
	readonly compact?: boolean;
	readonly testID?: string;
}

/** Width of the node column; the line runs down its middle. */
const NODE_COLUMN_CLASS = "w-8 items-center";

export function TimelineRailItem({ node, children, isLast = false, compact = false, testID }: TimelineRailItemProps): React.JSX.Element {
	return (
		<View className="flex-row gap-3" testID={testID}>
			<View className={NODE_COLUMN_CLASS} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
				<View className={`absolute w-0.5 bg-border ${isLast ? "top-0 h-4" : "top-0 bottom-0"}`} />
				{node}
			</View>
			<View testID={testID === undefined ? undefined : `${testID}-content`} className={`flex-1 ${compact ? "min-h-8 justify-center" : ""} ${isLast ? "" : "pb-5"}`}>
				{children}
			</View>
		</View>
	);
}

export type TimelineRailTone = "neutral" | "success" | "danger" | "attention" | "done";

/** Fill and glyph per tone — design tokens only (ADR 030). */
const TONE_CLASSES: Readonly<Record<TimelineRailTone, { readonly disc: string; readonly glyph: string }>> = {
	neutral: { disc: "border border-border bg-muted", glyph: "accent-muted-foreground" },
	success: { disc: "bg-success", glyph: "accent-status-foreground" },
	danger: { disc: "bg-destructive", glyph: "accent-status-foreground" },
	attention: { disc: "bg-warning-soft", glyph: "accent-warning-foreground" },
	done: { disc: "bg-tone-violet", glyph: "accent-status-foreground" },
};

export interface TimelineRailIconProps {
	readonly icon: LucideIcon;
	readonly tone?: TimelineRailTone;
}

/** A small disc on the line holding an event's glyph; it covers the line behind it. */
export function TimelineRailIcon({ icon, tone = "neutral" }: TimelineRailIconProps): React.JSX.Element {
	const classes = TONE_CLASSES[tone];
	return (
		<View className={`size-8 items-center justify-center rounded-full ${classes.disc}`}>
			<Icon icon={icon} size="sm" colorClassName={classes.glyph} />
		</View>
	);
}
