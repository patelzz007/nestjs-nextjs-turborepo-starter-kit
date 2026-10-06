"use client";

import { KpiStatCard } from "@workspace/ui/components/kpi-stat-card";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

import type { KpiView } from "./analytics-presentation";

export interface AnalyticsKpiGridProps<TKey extends string> {
	readonly kpis: readonly KpiView<TKey>[];
	/** What every change is measured against ("vs 7 Aug – 5 Sep 2026"); `undefined` while loading. */
	readonly comparisonLabel: string | undefined;
	/** Accessible name of the group, e.g. "Sales". */
	readonly label: string;
	readonly className?: string;
}

/** A row of KPI cards (one per view), named as a group; it wraps from one column on a phone to the caller's grid. */
export function AnalyticsKpiGrid<TKey extends string>({ kpis, comparisonLabel, label, className }: AnalyticsKpiGridProps<TKey>): React.JSX.Element {
	return (
		<div role="group" aria-label={label} className={cn("grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4", className)}>
			{kpis.map((kpi) => (
				<KpiStatCard key={kpi.key} label={kpi.label} icon={kpi.icon} value={kpi.value} change={kpi.change} comparisonLabel={comparisonLabel} />
			))}
		</div>
	);
}
