// One headline number with how it moved since the previous period: its label,
// the value, a change pill (an arrow, the signed percent, and a tone that says
// whether the move is good news) and, optionally, a sparkline of the range.
// The change is never colour alone — the arrow and the sign carry it too.
//
// Presentational: the caller formats the value and decides the change's
// direction and sentiment. `size="hero"` is the one number a screen leads with.

import type { ToDiscoUnion } from "@workspace/shared";
import ArrowDownRightIcon from "lucide-react-native/icons/arrow-down-right";
import ArrowRightIcon from "lucide-react-native/icons/arrow-right";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import * as React from "react";
import { Text, View } from "react-native";

import type { ChartColor } from "./chart-colors";
import { Icon, type LucideIcon } from "./icon";
import { Sparkline } from "./sparkline";

export type KpiDirection = "up" | "down" | "flat";

export type KpiSentiment = "positive" | "negative" | "neutral";

/** How the value moved: a signed change, or nothing to compare with. */
export type KpiChange = ToDiscoUnion<
	{
		change: { readonly direction: KpiDirection; readonly sentiment: KpiSentiment; readonly label: string };
		noPrevious: { readonly label: string };
	},
	"status"
>;

export interface KpiTileProps {
	readonly label: string;
	readonly value: string;
	readonly change: KpiChange;
	/** What the change is measured against ("vs previous 30 days"). */
	readonly comparisonLabel: string;
	readonly trend?: { readonly values: readonly number[]; readonly color: ChartColor };
	readonly size?: "default" | "hero";
	readonly testID?: string;
}

const DIRECTION_ICONS: Readonly<Record<KpiDirection, LucideIcon>> = {
	up: ArrowUpRightIcon,
	down: ArrowDownRightIcon,
	flat: ArrowRightIcon,
};

const DIRECTION_WORDS: Readonly<Record<Exclude<KpiDirection, "flat">, string>> = {
	up: "Up",
	down: "Down",
};

const SENTIMENT_CLASSES: Readonly<Record<KpiSentiment, { readonly container: string; readonly text: string; readonly icon: string }>> = {
	positive: { container: "bg-success-soft", text: "text-success-foreground", icon: "accent-success-foreground" },
	negative: { container: "bg-destructive-soft", text: "text-destructive-foreground", icon: "accent-destructive-foreground" },
	neutral: { container: "bg-muted", text: "text-muted-foreground", icon: "accent-muted-foreground" },
};

const SIZE_CLASSES: Readonly<Record<"default" | "hero", { readonly value: string; readonly label: string }>> = {
	default: { value: "text-2xl", label: "text-sm" },
	hero: { value: "text-5xl", label: "text-base" },
};

/** What a screen reader says for the change ("Up 12.4% vs previous 30 days", "No change vs previous 7 days"). */
export function describeKpiChange(change: KpiChange, comparisonLabel: string): string {
	if (change.status === "noPrevious") {
		return change.label;
	}
	return change.direction === "flat" ? `No change ${comparisonLabel}` : `${DIRECTION_WORDS[change.direction]} ${change.label} ${comparisonLabel}`;
}

export function KpiTile({ label, value, change, comparisonLabel, trend, size = "default", testID }: KpiTileProps): React.JSX.Element {
	const sizeClasses = SIZE_CLASSES[size];
	return (
		<View className="gap-2" accessible accessibilityLabel={`${label}: ${value}. ${describeKpiChange(change, comparisonLabel)}`} testID={testID}>
			<Text className={`font-sans-medium text-muted-foreground ${sizeClasses.label}`}>{label}</Text>
			<Text className={`font-sans-semibold text-foreground ${sizeClasses.value}`} numberOfLines={1} adjustsFontSizeToFit>
				{value}
			</Text>
			<View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
				<ChangePill change={change} />
				{change.status === "change" ? <Text className="font-sans text-xs text-muted-foreground">{comparisonLabel}</Text> : null}
			</View>
			{trend === undefined ? null : <Sparkline values={trend.values} color={trend.color} />}
		</View>
	);
}

interface ChangePillProps {
	readonly change: KpiChange;
}

function ChangePill({ change }: ChangePillProps): React.JSX.Element {
	if (change.status === "noPrevious") {
		return <Text className="font-sans text-xs text-muted-foreground">{change.label}</Text>;
	}
	const classes = SENTIMENT_CLASSES[change.sentiment];
	return (
		<View className={`flex-row items-center gap-0.5 rounded-full py-0.5 pr-2 pl-1.5 ${classes.container}`}>
			<Icon icon={DIRECTION_ICONS[change.direction]} size="sm" weight="bold" colorClassName={classes.icon} />
			<Text className={`font-sans-semibold text-xs ${classes.text}`}>{change.label}</Text>
		</View>
	);
}
