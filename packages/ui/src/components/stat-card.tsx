import { IconTile, type IconTileTone } from "@workspace/ui/components/icon-tile";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface StatCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
	readonly label: string;
	/** The formatted headline value. */
	readonly value: string;
	readonly hint: string;
	readonly icon: React.ReactNode;
	/** The icon tile's colour — pick by what the stat is about, so a row of cards scans by meaning. */
	readonly tone?: IconTileTone;
}

/**
 * A compact headline number for a page's summary row (web wallet, merchant
 * dashboards). Data-agnostic: every string arrives formatted. For a metric
 * compared against a previous period use `KpiStatCard`.
 */
export const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(function StatCard(
	{ label, value, hint, icon, tone = "brand", className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="stat-card" className={cn("rounded-lg border border-border bg-card p-4 shadow-sm inset-shadow-edge", className)} {...props}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-2">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
					<p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
					<p className="text-xs text-muted-foreground">{hint}</p>
				</div>
				<IconTile tone={tone}>{icon}</IconTile>
			</div>
		</div>
	);
});
