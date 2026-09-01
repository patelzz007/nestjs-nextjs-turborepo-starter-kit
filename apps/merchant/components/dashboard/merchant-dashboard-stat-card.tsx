"use client";

import { Card, CardContent } from "@workspace/ui/components/display/card";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import * as React from "react";

export type DashboardStatTone = "success" | "info" | "accent" | "warning";

const TONE_STYLES: Record<DashboardStatTone, { readonly icon: string; readonly trend: string }> = {
	success: {
		icon: "bg-success-soft text-success",
		trend: "text-success",
	},
	info: {
		icon: "bg-info-soft text-info",
		trend: "text-info",
	},
	accent: {
		icon: "bg-chart-4/10 text-chart-4",
		trend: "text-chart-4",
	},
	warning: {
		icon: "bg-warning-soft text-warning",
		trend: "text-warning",
	},
};

export interface MerchantDashboardStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly label: string;
	readonly value?: string;
	readonly icon: LucideIcon;
	readonly tone: DashboardStatTone;
	readonly changePercent?: number | null;
	readonly isLoading?: boolean;
}

function formatTrend(changePercent: number): { readonly label: string; readonly positive: boolean } {
	const sign = changePercent > 0 ? "+" : "";
	return { label: `${sign}${String(changePercent)}%`, positive: changePercent >= 0 };
}

/** Dashboard KPI tile — matches welcome-page stat card layout. */
export const MerchantDashboardStatCard = React.forwardRef<HTMLDivElement, MerchantDashboardStatCardProps>(function MerchantDashboardStatCard(
	{ label, value, icon: Icon, tone, changePercent = null, isLoading = false, className, ...props },
	ref,
): React.JSX.Element {
	const toneStyle = TONE_STYLES[tone];
	const trend = changePercent !== null ? formatTrend(changePercent) : null;

	return (
		<Card ref={ref} className={cn("relative overflow-hidden border-border/80 bg-card shadow-xs", className)} {...props}>
			<CardContent className="p-5">
				<div className="flex items-center justify-between">
					<div className={cn("flex size-10 items-center justify-center rounded-xl", toneStyle.icon)}>
						<Icon className="size-5" aria-hidden="true" />
					</div>
					{trend !== null ? (
						<div className={cn("flex items-center gap-1 text-sm font-medium tabular-nums", trend.positive ? toneStyle.trend : "text-destructive")}>
							{trend.positive ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownRight className="size-4" aria-hidden="true" />}
							<span>{trend.label}</span>
						</div>
					) : null}
				</div>
				<div className="mt-4">
					{isLoading || value === undefined ? (
						<Skeleton className="h-8 w-20" />
					) : (
						<>
							<p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums lg:text-3xl">{value}</p>
							<p className="mt-1 text-sm text-muted-foreground">{label}</p>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
});
