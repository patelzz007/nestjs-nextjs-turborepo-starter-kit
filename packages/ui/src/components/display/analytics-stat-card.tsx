"use client";

import { Card, CardContent } from "@workspace/ui/components/display/card";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import * as React from "react";

export type AnalyticsStatAccent = "primary" | "info" | "success" | "warning" | "secondary";

const ACCENT_STYLES: Record<
	AnalyticsStatAccent,
	{
		readonly icon: string;
		readonly glow: string;
		readonly bar: string;
	}
> = {
	primary: {
		icon: "bg-primary/12 text-primary ring-primary/20",
		glow: "bg-primary/30",
		bar: "bg-primary",
	},
	info: {
		icon: "bg-info-soft text-info ring-info/25",
		glow: "bg-info/25",
		bar: "bg-info",
	},
	success: {
		icon: "bg-success-soft text-success ring-success/25",
		glow: "bg-success/25",
		bar: "bg-success",
	},
	warning: {
		icon: "bg-warning-soft text-warning ring-warning/25",
		glow: "bg-warning/30",
		bar: "bg-warning",
	},
	secondary: {
		icon: "bg-secondary text-secondary-foreground ring-border/60",
		glow: "bg-muted-foreground/15",
		bar: "bg-muted-foreground/50",
	},
};

export interface AnalyticsStatCardProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly label: string;
	readonly value?: string;
	readonly icon: LucideIcon;
	readonly accent?: AnalyticsStatAccent;
	readonly changePercent?: number | null;
	readonly isLoading?: boolean;
}

function formatTrend(changePercent: number): { readonly label: string; readonly positive: boolean } {
	const sign = changePercent > 0 ? "+" : "";
	return { label: `${sign}${String(changePercent)}%`, positive: changePercent >= 0 };
}

/** KPI tile for analytics dashboards — label, hero value, accent icon, and optional trend. */
export const AnalyticsStatCard = React.forwardRef<HTMLDivElement, AnalyticsStatCardProps>(function AnalyticsStatCard(
	{ label, value, icon: Icon, accent = "primary", changePercent = null, isLoading = false, className, ...props },
	ref,
): React.JSX.Element {
	const accentStyle = ACCENT_STYLES[accent];
	const trend = changePercent !== null ? formatTrend(changePercent) : null;

	return (
		<Card
			ref={ref}
			className={cn(
				"group relative overflow-hidden border-border/70 bg-card shadow-xs transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-md",
				className,
			)}
			{...props}>
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-70",
					accentStyle.glow,
				)}
			/>
			<div aria-hidden="true" className={cn("absolute inset-x-0 bottom-0 h-0.5 opacity-70", accentStyle.bar)} />

			<CardContent className="relative p-5">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1 space-y-3">
						<p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
						{isLoading || value === undefined ? (
							<Skeleton className="h-9 w-24 rounded-md" />
						) : (
							<p className="font-button text-3xl font-bold tracking-tight text-foreground tabular-nums lg:text-[2rem] lg:leading-none">{value}</p>
						)}
					</div>

					<div
						className={cn(
							"flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 ring-inset group-hover:scale-105",
							accentStyle.icon,
						)}>
						<Icon className="size-5" aria-hidden="true" />
					</div>
				</div>

				{trend !== null ? (
					<div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
						<span
							className={cn(
								"inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
								trend.positive ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
							)}>
							{trend.positive ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
							{trend.label}
						</span>
						<span className="text-xs text-muted-foreground">vs last period</span>
					</div>
				) : (
					<div className="mt-4 h-5" aria-hidden="true" />
				)}
			</CardContent>
		</Card>
	);
});
