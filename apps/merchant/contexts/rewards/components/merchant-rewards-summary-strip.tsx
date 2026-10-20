import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** The strip's figures: live offers, in pipeline, units left. */
export const REWARDS_SUMMARY_ITEM_COUNT = 3;

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

export interface MerchantRewardsSummaryStripSkeletonProps {
	readonly className?: string;
}

/** The strip's silhouette — an icon tile beside a label, figure and hint per item. Bones only: wrap in a `SkeletonRegion`. */
export function MerchantRewardsSummaryStripSkeleton({ className }: MerchantRewardsSummaryStripSkeletonProps): React.JSX.Element {
	return (
		<div data-slot="rewards-summary-skeleton" className={cn("grid gap-3 sm:grid-cols-3", className)}>
			{placeholderKeys("summary", REWARDS_SUMMARY_ITEM_COUNT).map((key): React.JSX.Element => (
				<div key={key} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
					<Skeleton className="size-9 rounded-lg" />
					<div className="flex min-w-0 flex-1 flex-col gap-1.5">
						<Skeleton variant="text" className="h-3 w-20" />
						<Skeleton className="h-6 w-12" />
						<Skeleton variant="text" className="h-3 w-32 max-w-full" />
					</div>
				</div>
			))}
		</div>
	);
}
