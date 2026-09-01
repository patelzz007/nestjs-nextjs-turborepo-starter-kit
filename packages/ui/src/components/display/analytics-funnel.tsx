"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export type AnalyticsFunnelAccent = "primary" | "info" | "success" | "warning";

const FUNNEL_ACCENTS: Record<AnalyticsFunnelAccent, { readonly ring: string; readonly value: string; readonly connector: string }> = {
	primary: {
		ring: "bg-primary/10",
		value: "text-primary",
		connector: "bg-primary/25",
	},
	info: {
		ring: "bg-info-soft",
		value: "text-info",
		connector: "bg-info/25",
	},
	success: {
		ring: "bg-success-soft",
		value: "text-success",
		connector: "bg-success/25",
	},
	warning: {
		ring: "bg-warning-soft",
		value: "text-warning",
		connector: "bg-warning/25",
	},
};

export interface AnalyticsFunnelStep {
	readonly label: string;
	readonly value: string;
	readonly accent: AnalyticsFunnelAccent;
}

export interface AnalyticsFunnelProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly title: string;
	readonly description: string;
	readonly steps: readonly AnalyticsFunnelStep[];
	readonly isLoading?: boolean;
}

/** Horizontal conversion funnel with semantic accent rings. */
export const AnalyticsFunnel = React.forwardRef<HTMLDivElement, AnalyticsFunnelProps>(function AnalyticsFunnel(
	{ title, description, steps, isLoading = false, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<Card ref={ref} className={cn("border-border/80 bg-card shadow-xs", className)} {...props}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-32 w-full" />
				) : (
					<div className="flex flex-col items-stretch justify-between gap-8 sm:flex-row sm:items-center sm:gap-4">
						{steps.map((step, index) => {
							const accent = FUNNEL_ACCENTS[step.accent];
							const isLast = index === steps.length - 1;

							return (
								<React.Fragment key={step.label}>
									<div className="flex flex-1 flex-col items-center text-center">
										<div className={cn("mb-3 flex size-20 items-center justify-center rounded-full sm:size-24", accent.ring)}>
											<span className={cn("text-xl font-bold tabular-nums sm:text-2xl", accent.value)}>{step.value}</span>
										</div>
										<p className="text-sm text-muted-foreground">{step.label}</p>
									</div>
									{!isLast ? <div className={cn("hidden h-1 max-w-16 flex-1 rounded-full sm:block", accent.connector)} aria-hidden="true" /> : null}
								</React.Fragment>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
});
