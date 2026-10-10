// A small status capsule: an icon and an optional label ("Online", "14m 32s"),
// in a tone. Presentational and data-agnostic — the caller says what it shows.
// Read by screen readers as one piece of text, through `accessibilityLabel`.
// `pulsing` breathes the whole pill (a pending check) and stays still under
// Reduce Motion; `emphasized` draws the tone's full-strength border (a change
// that just happened).

import * as React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { usePulseStyle } from "../lib/use-pulse-style";
import { Icon, type LucideIcon } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export type StatusPillTone = "neutral" | "success" | "destructive";

interface ToneClasses {
	readonly container: string;
	readonly border: string;
	readonly emphasizedBorder: string;
	readonly text: string;
	readonly icon: string;
}

const TONE_CLASSES: Readonly<Record<StatusPillTone, ToneClasses>> = {
	neutral: { container: "bg-muted", border: "border-border", emphasizedBorder: "border-muted-foreground", text: "text-muted-foreground", icon: "accent-muted-foreground" },
	success: {
		container: "bg-success-soft",
		border: "border-success/30",
		emphasizedBorder: "border-success",
		text: "text-success-foreground",
		icon: "accent-success-foreground",
	},
	destructive: {
		container: "bg-destructive-soft",
		border: "border-destructive/30",
		emphasizedBorder: "border-destructive",
		text: "text-destructive-foreground",
		icon: "accent-destructive-foreground",
	},
};

export interface StatusPillProps {
	readonly icon: LucideIcon;
	/** `null`: the icon alone — `accessibilityLabel` still names the state. */
	readonly label: string | null;
	readonly accessibilityLabel: string;
	readonly tone?: StatusPillTone;
	readonly emphasized?: boolean;
	readonly pulsing?: boolean;
	/** Monospaced digits, so a ticking value does not resize the pill. */
	readonly tabularLabel?: boolean;
	readonly testID?: string;
}

export function StatusPill({
	icon,
	label,
	accessibilityLabel,
	tone = "neutral",
	emphasized = false,
	pulsing = false,
	tabularLabel = false,
	testID,
}: StatusPillProps): React.JSX.Element {
	const classes = TONE_CLASSES[tone];
	const className = `flex-row items-center gap-1.5 self-start rounded-full border py-1 ${label === null ? "px-1.5" : "px-2.5"} ${classes.container} ${emphasized ? classes.emphasizedBorder : classes.border}`;
	const content = (
		<>
			<Icon icon={icon} size="sm" weight={emphasized ? "bold" : "regular"} colorClassName={classes.icon} />
			{label === null ? null : (
				<Text numberOfLines={1} className={`text-xs ${tabularLabel ? "font-mono" : "font-sans-medium"} ${classes.text}`}>
					{label}
				</Text>
			)}
		</>
	);

	if (pulsing) {
		return (
			<PulsingPill className={className} accessibilityLabel={accessibilityLabel} testID={testID}>
				{content}
			</PulsingPill>
		);
	}
	return (
		<View accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} className={className} testID={testID}>
			{content}
		</View>
	);
}

interface PulsingPillProps {
	readonly className: string;
	readonly accessibilityLabel: string;
	readonly testID: string | undefined;
	readonly children: React.ReactNode;
}

/** Its own component, so the breathing animation runs only while a pill pulses. */
function PulsingPill({ className, accessibilityLabel, testID, children }: PulsingPillProps): React.JSX.Element {
	const pulseStyle = usePulseStyle();
	return (
		<StyledAnimatedView accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel} className={className} style={pulseStyle} testID={testID}>
			{children}
		</StyledAnimatedView>
	);
}
