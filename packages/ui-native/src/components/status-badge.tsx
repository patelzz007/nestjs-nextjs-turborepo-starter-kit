// A small status capsule: an icon and an optional label ("Online", "14m 32s"),
// in a tone. Presentational and data-agnostic — the caller says what it shows.
// Read by screen readers as one piece of text, through `accessibilityLabel`.
// `pulsing` breathes the whole pill (a pending check) and stays still under
// Reduce Motion; `emphasized` draws the tone's full-strength border (a change
// that just happened).
//
// The tone is what the status MEANS (rules/07, "Status badges and icon
// tiles"): `success` live / usable, `warning` waiting on someone, `destructive`
// failed / blocked, `info` in progress, `neutral` settled or inactive.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { usePulseStyle } from "../lib/use-pulse-style";
import { Icon, type LucideIcon } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export const statusBadgeVariants = cva("flex-row items-center gap-1.5 self-start rounded-full border py-1", {
	variants: {
		tone: {
			neutral: "border-border bg-muted",
			info: "border-info/30 bg-info-soft",
			success: "border-success/30 bg-success-soft",
			warning: "border-warning/30 bg-warning-soft",
			destructive: "border-destructive/30 bg-destructive-soft",
		},
		/** The tone's full-strength border: a change that just happened. */
		emphasized: { true: "", false: "" },
		/** An icon alone pads evenly; with a label the pill is wider. */
		iconOnly: { true: "px-1.5", false: "px-2.5" },
	},
	compoundVariants: [
		{ emphasized: true, tone: "neutral", className: "border-muted-foreground" },
		{ emphasized: true, tone: "info", className: "border-info" },
		{ emphasized: true, tone: "success", className: "border-success" },
		{ emphasized: true, tone: "warning", className: "border-warning" },
		{ emphasized: true, tone: "destructive", className: "border-destructive" },
	],
	defaultVariants: { tone: "neutral", emphasized: false, iconOnly: false },
});

export const statusBadgeLabelVariants = cva("text-xs", {
	variants: {
		tone: {
			neutral: "text-muted-foreground",
			info: "text-info-foreground",
			success: "text-success-foreground",
			warning: "text-warning-foreground",
			destructive: "text-destructive-foreground",
		},
		/** Monospaced digits, so a ticking value does not resize the pill. */
		tabular: { true: "font-mono", false: "font-sans-medium" },
	},
	defaultVariants: { tone: "neutral", tabular: false },
});

/** The icon's colour per tone (Uniwind `accent-*` → the icon's `color`). */
export const statusBadgeIconVariants = cva("", {
	variants: {
		tone: {
			neutral: "accent-muted-foreground",
			info: "accent-info-foreground",
			success: "accent-success-foreground",
			warning: "accent-warning-foreground",
			destructive: "accent-destructive-foreground",
		},
	},
	defaultVariants: { tone: "neutral" },
});

export type StatusBadgeTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>;

export interface StatusBadgeProps {
	readonly icon: LucideIcon;
	/** `null`: the icon alone — `accessibilityLabel` still names the state. */
	readonly label: string | null;
	readonly accessibilityLabel: string;
	readonly tone?: StatusBadgeTone;
	readonly emphasized?: boolean;
	readonly pulsing?: boolean;
	/** Monospaced digits, so a ticking value does not resize the pill. */
	readonly tabularLabel?: boolean;
	/** Extra classes for the pill, merged last. */
	readonly className?: string;
	readonly testID?: string;
}

export const StatusBadge = React.memo(
	React.forwardRef<View, StatusBadgeProps>(function StatusBadge(
		{ icon, label, accessibilityLabel, tone = "neutral", emphasized = false, pulsing = false, tabularLabel = false, className, testID },
		ref,
	): React.JSX.Element {
		const pillClassName = cn(statusBadgeVariants({ tone, emphasized, iconOnly: label === null }), className);
		const content = (
			<>
				<Icon icon={icon} size="sm" weight={emphasized ? "bold" : "regular"} colorClassName={statusBadgeIconVariants({ tone })} />
				{label === null ? null : (
					<Text numberOfLines={1} className={statusBadgeLabelVariants({ tone, tabular: tabularLabel })}>
						{label}
					</Text>
				)}
			</>
		);

		if (pulsing) {
			return (
				<PulsingPill ref={ref} className={pillClassName} accessibilityLabel={accessibilityLabel} testID={testID}>
					{content}
				</PulsingPill>
			);
		}
		return (
			<View ref={ref} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} className={pillClassName} testID={testID}>
				{content}
			</View>
		);
	}),
);

interface PulsingPillProps {
	readonly className: string;
	readonly accessibilityLabel: string;
	readonly testID: string | undefined;
	readonly children: React.ReactNode;
}

/** Its own component, so the breathing animation runs only while a pill pulses. */
const PulsingPill = React.forwardRef<View, PulsingPillProps>(function PulsingPill({ className, accessibilityLabel, testID, children }, ref): React.JSX.Element {
	const pulseStyle = usePulseStyle();
	return (
		<StyledAnimatedView ref={ref} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} className={className} style={pulseStyle} testID={testID}>
			{children}
		</StyledAnimatedView>
	);
});
