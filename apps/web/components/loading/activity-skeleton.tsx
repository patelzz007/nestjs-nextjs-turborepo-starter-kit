import { ACTIVITY_LOADING_LABELS } from "@/components/loading/loading-labels";
import { CUSTOMER_REFERRAL_KPIS, CUSTOMER_REWARD_KPIS, CUSTOMER_SPENDING_KPIS } from "@/contexts/reporting/lib/customer-analytics";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { ChartSkeleton, PageHeaderSkeleton, StatCardsSkeleton } from "@workspace/ui/components/skeleton-patterns";
import * as React from "react";

/** `AnalyticsKpiGrid`'s breakpoints on top of the pattern's own grid: two up from 420px, a full row from `lg`. */
const FOUR_KPI_GRID_CLASS = "min-[420px]:grid-cols-2 lg:grid-cols-4";
const THREE_KPI_GRID_CLASS = "min-[420px]:grid-cols-2 lg:grid-cols-3";

/** `AnalyticsRangeControls`: the labelled range and interval menus, then the resolved range line. */
function RangeControlsSkeleton(): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-end gap-3">
			<div className="flex flex-col gap-1.5">
				<Skeleton variant="text" className="my-0.5 h-3 w-12" />
				<Skeleton className="h-9 w-44" />
			</div>
			<div className="flex flex-col gap-1.5">
				<Skeleton variant="text" className="my-0.5 h-3 w-14" />
				<Skeleton className="h-9 w-28" />
			</div>
			<Skeleton variant="text" className="mb-2 h-4 w-48" />
		</div>
	);
}

/**
 * `/dashboard/activity` while the server prefetches the dashboard: header,
 * range controls, the spending / rewards / referrals KPI rows (as many cards
 * as each row defines), then the chart panels in their two grids.
 */
export function ActivityPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={ACTIVITY_LOADING_LABELS} className="flex flex-col gap-6">
			<PageHeaderSkeleton />
			<RangeControlsSkeleton />
			<StatCardsSkeleton count={CUSTOMER_SPENDING_KPIS.length} columns={4} className={FOUR_KPI_GRID_CLASS} />
			<StatCardsSkeleton count={CUSTOMER_REWARD_KPIS.length} columns={3} className={THREE_KPI_GRID_CLASS} />
			<StatCardsSkeleton count={CUSTOMER_REFERRAL_KPIS.length} columns={3} className={THREE_KPI_GRID_CLASS} />
			<div className="grid gap-6 xl:grid-cols-2">
				<ChartSkeleton withControls={false} />
				<ChartSkeleton withControls={false} />
				<ChartSkeleton size="sm" withControls={false} className="xl:col-span-2" />
			</div>
			<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
				<ChartSkeleton size="sm" withControls={false} />
				<ChartSkeleton size="sm" withControls={false} />
				<ChartSkeleton withControls={false} className="lg:col-span-2 2xl:col-span-1" />
			</div>
		</SkeletonRegion>
	);
}
