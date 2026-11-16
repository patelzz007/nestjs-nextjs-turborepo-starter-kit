// One headline number with its change against the previous period (the web
// kit's `KpiStatCard`). The direction is a glyph AND words (never colour
// alone): screen readers hear "Revenue: RM 48,210, up +12.4% vs the previous
// 30 days". The caller says whether the move is good news (`sentiment`: more
// sales is good, more refunds is not), so the card never assumes "up = green".
// "No previous data" is its own state. While loading, bones hold the value and
// the change, and the card is announced busy.
//
// Data-agnostic: every string arrives formatted. The ref reaches the card.

import { cva } from "class-variance-authority";
import ArrowDownRightIcon from "lucide-react-native/icons/arrow-down-right";
import ArrowUpRightIcon from "lucide-react-native/icons/arrow-up-right";
import MinusIcon from "lucide-react-native/icons/minus";
import * as React from "react";
import { Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { Icon, type LucideIcon } from "./icon";
import { IconTile, type IconTileTone } from "./icon-tile";
import { Skeleton, SkeletonGroup } from "./skeleton";

/** Which way the value moved against the previous period. */
export type KpiChangeDirection = "up" | "down" | "flat";

/** Whether the move is good news; the caller decides. */
export type KpiChangeSentiment = "positive" | "negative" | "neutral";

/** The comparison line of a KPI, one state at a time. */
export type KpiChange =
	| {
			readonly status: "change";
			readonly direction: KpiChangeDirection;
			readonly sentiment: KpiChangeSentiment;
			/** The formatted change: "+12.5%", "+RM 120.00". */
			readonly label: string;
	  }
	/** The previous period had nothing to compare with. */
	| { readonly status: "noPrevious"; readonly label: string };

/** Screen-reader words for each direction (the glyph is decorative). */
export interface KpiDirectionLabels {
	readonly up: string;
	readonly down: string;
	readonly flat: string;
}

export const DEFAULT_KPI_DIRECTION_LABELS: KpiDirectionLabels = { up: "up", down: "down", flat: "no change" };

export const kpiStatCardVariants = cva("rounded-card gap-2 border border-border bg-card p-4");

export const kpiChangeVariants = cva("flex-row items-center gap-1 rounded-md px-1.5 py-0.5", {
	variants: {
		sentiment: { positive: "bg-tone-green-soft", negative: "bg-tone-red-soft", neutral: "bg-muted" },
	},
	defaultVariants: { sentiment: "neutral" },
});

export const kpiChangeTextVariants = cva("text-caption font-sans-semibold", {
	variants: {
		sentiment: { positive: "text-tone-green", negative: "text-tone-red", neutral: "text-muted-foreground" },
	},
	defaultVariants: { sentiment: "neutral" },
});

const kpiChangeIconVariants = cva("", {
	variants: {
		sentiment: { positive: "accent-tone-green", negative: "accent-tone-red", neutral: "accent-muted-foreground" },
	},
	defaultVariants: { sentiment: "neutral" },
});

const DIRECTION_ICONS: Readonly<Record<KpiChangeDirection, LucideIcon>> = { up: ArrowUpRightIcon, down: ArrowDownRightIcon, flat: MinusIcon };

/** What screen readers hear for the card: the label and value, then the change in words. */
export function describeKpi(label: string, value: string, change: KpiChange | undefined, comparisonLabel: string | undefined, directionLabels: KpiDirectionLabels): string {
	const head = `${label}: ${value}`;
	if (change === undefined) {
		return head;
	}
	if (change.status === "noPrevious") {
		return `${head}, ${change.label}`;
	}
	const comparison = comparisonLabel === undefined ? "" : ` ${comparisonLabel}`;
	return `${head}, ${directionLabels[change.direction]} ${change.label}${comparison}`;
}

export interface KpiStatCardProps {
	/** The metric's name. */
	readonly label: string;
	/** The formatted headline value; `undefined` while loading. */
	readonly value: string | undefined;
	/** The change against the previous period, or `noPrevious`. */
	readonly change?: KpiChange | undefined;
	/** What the change is measured against: "vs the previous 30 days". */
	readonly comparisonLabel?: string | undefined;
	/** A glyph for the metric, in a tinted tile. */
	readonly icon?: LucideIcon | undefined;
	/** The tile's tint, by what the KPI is about. Default `neutral`. */
	readonly iconTone?: IconTileTone | undefined;
	/** Bones in place of the value and the change. */
	readonly loading?: boolean | undefined;
	/** The directions' spoken words; English by default. */
	readonly directionLabels?: KpiDirectionLabels | undefined;
	/** Extra classes for the card, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

function KpiChangeLine({ change, comparisonLabel }: { readonly change: KpiChange; readonly comparisonLabel: string | undefined }): React.JSX.Element {
	if (change.status === "noPrevious") {
		return <Text className="text-caption font-sans text-muted-foreground">{change.label}</Text>;
	}
	return (
		<View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
			<View className={kpiChangeVariants({ sentiment: change.sentiment })}>
				<Icon icon={DIRECTION_ICONS[change.direction]} size="xs" colorClassName={kpiChangeIconVariants({ sentiment: change.sentiment })} />
				<Text className={kpiChangeTextVariants({ sentiment: change.sentiment })}>{change.label}</Text>
			</View>
			{comparisonLabel === undefined ? null : <Text className="text-caption font-sans text-muted-foreground">{comparisonLabel}</Text>}
		</View>
	);
}

export const KpiStatCard = React.memo(
	React.forwardRef<ViewInstance, KpiStatCardProps>(function KpiStatCard(
		{ label, value, change, comparisonLabel, icon, iconTone = "neutral", loading = false, directionLabels = DEFAULT_KPI_DIRECTION_LABELS, className, testID },
		ref,
	): React.JSX.Element {
		const showBones = loading || value === undefined;
		const accessibilityState = React.useMemo(() => ({ busy: showBones }), [showBones]);
		const name = showBones ? label : describeKpi(label, value, change, comparisonLabel, directionLabels);
		return (
			<View ref={ref} accessible accessibilityLabel={name} accessibilityState={accessibilityState} testID={testID} className={cn(kpiStatCardVariants(), className)}>
				<View className="flex-row items-center justify-between gap-2">
					<Text className="text-label font-sans-medium text-muted-foreground">{label}</Text>
					{icon === undefined ? null : <IconTile icon={icon} tone={iconTone} size="sm" />}
				</View>
				{showBones ? (
					<SkeletonGroup className="gap-2">
						<Skeleton className="h-8 w-28 rounded-md" />
						<Skeleton className="h-4 w-36 rounded-md" />
					</SkeletonGroup>
				) : (
					<>
						<Text className="text-h3 font-sans-semibold tracking-tight text-foreground tabular-nums">{value}</Text>
						{change === undefined ? null : <KpiChangeLine change={change} comparisonLabel={comparisonLabel} />}
					</>
				)}
			</View>
		);
	}),
);
