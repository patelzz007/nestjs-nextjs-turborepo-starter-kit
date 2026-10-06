"use client";

import { Card, CardContent } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva } from "class-variance-authority";
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import * as React from "react";

/** Which way the value moved against the previous period. */
export type KpiChangeDirection = "up" | "down" | "flat";

/**
 * Whether the move is good news. The caller decides (more sales is good, more
 * refunds is not), so the card never assumes "up = green".
 */
export type KpiChangeSentiment = "positive" | "negative" | "neutral";

/** The comparison line of a KPI — one state at a time. */
export type KpiChange =
	| {
			readonly status: "change";
			readonly direction: KpiChangeDirection;
			readonly sentiment: KpiChangeSentiment;
			/** The formatted change, e.g. "+12.5%" or "+RM 120.00". */
			readonly label: string;
	  }
	/** The previous period had nothing to compare with (no meaningful percentage). */
	| { readonly status: "noPrevious"; readonly label: string };

/** Screen-reader words for each direction (the icon itself is decorative) — the `kpiDirection` family of `UiKitLabels`. */
export interface KpiDirectionLabels {
	readonly up: string;
	readonly down: string;
	readonly flat: string;
}

const changeVariants = cva("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold", {
	variants: {
		sentiment: {
			positive: "bg-success-soft text-success",
			negative: "bg-destructive-soft text-destructive",
			neutral: "bg-muted text-muted-foreground",
		},
	},
	defaultVariants: { sentiment: "neutral" },
});

const DIRECTION_ICONS: Readonly<Record<KpiChangeDirection, LucideIcon>> = {
	up: ArrowUpRight,
	down: ArrowDownRight,
	flat: Minus,
};

export interface KpiStatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
	readonly label: string;
	/** The formatted headline value; `undefined` while loading. */
	readonly value: string | undefined;
	readonly change?: KpiChange | undefined;
	/** What the change is measured against, e.g. "vs previous 30 days". */
	readonly comparisonLabel?: string | undefined;
	readonly icon?: LucideIcon | undefined;
	readonly isLoading?: boolean;
	/** Per-usage overrides of the `kpiDirection` copy from `UiKitLabelsProvider`. */
	readonly directionLabels?: UiKitLabelsOverride<"kpiDirection"> | undefined;
}

function KpiChangeLine({
	change,
	comparisonLabel,
	directionLabels,
}: {
	readonly change: KpiChange;
	readonly comparisonLabel: string | undefined;
	readonly directionLabels: KpiDirectionLabels;
}): React.JSX.Element {
	if (change.status === "noPrevious") {
		return <p className="text-xs text-muted-foreground">{change.label}</p>;
	}
	const Icon = DIRECTION_ICONS[change.direction];
	return (
		<p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
			<span className={changeVariants({ sentiment: change.sentiment })}>
				<Icon className="size-3.5" aria-hidden="true" />
				<span className="sr-only">{directionLabels[change.direction]} </span>
				{change.label}
			</span>
			{comparisonLabel === undefined ? null : <span>{comparisonLabel}</span>}
		</p>
	);
}

/**
 * One headline number with its change against the previous period. The
 * direction is an icon AND words (never colour alone); "no previous data" is
 * its own state. Data-agnostic: every string arrives formatted.
 */
export const KpiStatCard = React.forwardRef<HTMLDivElement, KpiStatCardProps>(function KpiStatCard(
	{ label, value, change, comparisonLabel, icon: Icon, isLoading = false, directionLabels: directionLabelsOverride, className, ...props },
	ref,
): React.JSX.Element {
	const directionLabels = useUiKitLabels("kpiDirection", directionLabelsOverride);
	const showSkeleton = isLoading || value === undefined;
	return (
		<Card ref={ref} size="sm" aria-busy={showSkeleton} className={cn("border-border/80 bg-card shadow-xs", className)} {...props}>
			<CardContent className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<p className="text-sm font-medium text-muted-foreground">{label}</p>
					{Icon === undefined ? null : <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
				</div>
				{showSkeleton ? (
					<>
						<Skeleton className="h-8 w-28" />
						<Skeleton className="h-4 w-36" />
					</>
				) : (
					<>
						<p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
						{change === undefined ? null : <KpiChangeLine change={change} comparisonLabel={comparisonLabel} directionLabels={directionLabels} />}
					</>
				)}
			</CardContent>
		</Card>
	);
});
KpiStatCard.displayName = "KpiStatCard";
