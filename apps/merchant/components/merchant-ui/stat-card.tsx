import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface MerchantStatCardProps {
	readonly label: string;
	readonly value: string;
	readonly hint: string;
	readonly icon: React.ReactNode;
	readonly className?: string;
}

/** Compact KPI tile for merchant dashboards. */
export function MerchantStatCard({ label, value, hint, icon, className }: MerchantStatCardProps): React.JSX.Element {
	return (
		<div className={cn("rounded-xl border border-border bg-card p-4 shadow-xs", className)}>
			<div className="flex items-start justify-between gap-3">
				<div className="space-y-2">
					<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
					<p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
					<p className="text-xs text-muted-foreground">{hint}</p>
				</div>
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">{icon}</div>
			</div>
		</div>
	);
}
