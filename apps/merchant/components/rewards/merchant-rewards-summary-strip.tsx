import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

export interface MerchantRewardsSummaryItem {
	readonly label: string;
	readonly value: string;
	readonly hint: string;
	readonly icon: React.ReactNode;
}

export interface MerchantRewardsSummaryStripProps {
	readonly items: readonly MerchantRewardsSummaryItem[];
	readonly className?: string;
}

/** Inline KPI strip — lighter than three separate stat cards. */
export function MerchantRewardsSummaryStrip({ items, className }: MerchantRewardsSummaryStripProps): React.JSX.Element {
	return (
		<div className={cn("grid gap-3 sm:grid-cols-3", className)}>
			{items.map((item) => (
				<div key={item.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-primary">{item.icon}</div>
					<div className="min-w-0">
						<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</p>
						<p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">{item.value}</p>
						<p className="truncate text-xs text-muted-foreground">{item.hint}</p>
					</div>
				</div>
			))}
		</div>
	);
}
