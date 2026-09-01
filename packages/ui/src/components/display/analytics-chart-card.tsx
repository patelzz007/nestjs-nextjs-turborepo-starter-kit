"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface AnalyticsChartCardProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly title: string;
	readonly description: string;
	readonly isLoading?: boolean;
	readonly children: React.ReactNode;
	readonly legend?: React.ReactNode;
}

/** Chart panel with consistent header, border, and loading skeleton. */
export const AnalyticsChartCard = React.forwardRef<HTMLDivElement, AnalyticsChartCardProps>(function AnalyticsChartCard(
	{ title, description, isLoading = false, children, legend, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<Card ref={ref} className={cn("border-border/80 bg-card shadow-xs", className)} {...props}>
			<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
				<div className="space-y-1">
					<CardTitle>{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</div>
				{legend !== undefined ? <div className="flex flex-wrap items-center gap-3">{legend}</div> : null}
			</CardHeader>
			<CardContent>{isLoading ? <Skeleton className="h-[300px] w-full rounded-lg" /> : children}</CardContent>
		</Card>
	);
});

export interface AnalyticsChartLegendItemProps {
	readonly label: string;
	readonly colorClass: string;
}

export function AnalyticsChartLegendItem({ label, colorClass }: AnalyticsChartLegendItemProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<span className={cn("size-2.5 rounded-full", colorClass)} aria-hidden="true" />
			<span>{label}</span>
		</div>
	);
}
