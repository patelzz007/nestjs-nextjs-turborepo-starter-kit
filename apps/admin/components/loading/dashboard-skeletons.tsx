import { Skeleton } from "@workspace/ui/components/skeleton";
import { ChartSkeleton, ListSkeleton, PageHeaderSkeleton, StatCardsSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { ANALYTICS_LOADING_LABELS, DASHBOARD_LOADING_LABELS } from "@/components/loading/loading-labels";
import { SectionBones } from "@/components/loading/section-skeleton";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { ADMIN_CUSTOMER_KPIS, ADMIN_REWARD_KPIS, ADMIN_SALES_KPIS } from "@/lib/analytics/admin-analytics";

// ── Analytics ────────────────────────────────────────────────────────────────

/** Sales, bills, claims & redemptions, new vs returning customers. */
const ANALYTICS_TIME_SERIES_PANELS = 4;
/** Ranked rows drawn in each breakdown panel. */
const ANALYTICS_RANKED_ROWS = 5;
/** Top merchants (wide on `lg`), sales by category, sales by city. */
const ANALYTICS_BREAKDOWN_PANELS: readonly { readonly key: string; readonly className: string }[] = [
	{ key: "top-merchants", className: "lg:col-span-2 2xl:col-span-1" },
	{ key: "by-category", className: "" },
	{ key: "by-city", className: "" },
];

/**
 * `/analytics`: header (+ export), the range controls, the sales / customer /
 * reward KPI rows, the four time series and the three ranked breakdowns.
 */
export function AnalyticsPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={ANALYTICS_LOADING_LABELS} className="flex flex-col gap-6">
			<PageHeaderSkeleton actions={1} />
			<div className="flex flex-wrap items-center gap-2">
				<Skeleton className="h-9 w-80 max-w-full" />
				<Skeleton className="h-9 w-56" />
			</div>
			<StatCardsSkeleton count={ADMIN_SALES_KPIS.length} columns={4} className="lg:grid-cols-4" />
			<StatCardsSkeleton count={ADMIN_CUSTOMER_KPIS.length} columns={3} className="lg:grid-cols-3" />
			<StatCardsSkeleton count={ADMIN_REWARD_KPIS.length} columns={3} className="lg:grid-cols-3" />
			<div className="grid gap-6 xl:grid-cols-2">
				{placeholderKeys("series", ANALYTICS_TIME_SERIES_PANELS).map((key) => (
					<ChartSkeleton key={key} withControls={false} />
				))}
			</div>
			<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
				{ANALYTICS_BREAKDOWN_PANELS.map((panel) => (
					<ListSkeleton key={panel.key} leading="none" rows={ANALYTICS_RANKED_ROWS} className={panel.className} />
				))}
			</div>
		</SkeletonRegion>
	);
}

// ── Dashboard (`/`) ──────────────────────────────────────────────────────────

/** The "Jump to" buttons of the demo index (`DEMO_ANCHORS` in dashboard-gallery.tsx). */
const DASHBOARD_DEMO_ANCHORS = 7;
/** The first gallery sections' reserved heights — breadcrumbs, then the table (the rest sit below the fold). */
const DASHBOARD_FIRST_SECTION_HEIGHTS: readonly { readonly key: string; readonly height: string }[] = [
	{ key: "breadcrumbs", height: "h-24" },
	{ key: "table", height: "h-[400px]" },
];

/** Horizontal gutter the dashboard's own sections use. */
const DASHBOARD_GUTTER = "px-4 lg:px-6";

/**
 * `/`: the demo index, the platform-sales headline (KPIs + daily chart), the
 * component-gallery heading and the first gallery sections.
 */
export function DashboardPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={DASHBOARD_LOADING_LABELS} className="flex flex-1 flex-col gap-4 pt-4 md:gap-6 md:pt-6">
			<div className={cn("flex flex-wrap items-center gap-2", DASHBOARD_GUTTER)}>
				<Skeleton variant="text" className="h-3 w-12" />
				{placeholderKeys("anchor", DASHBOARD_DEMO_ANCHORS).map((key) => (
					<Skeleton key={key} data-skeleton="demo-anchor" className="h-8 w-20" />
				))}
			</div>
			<div className={cn("flex flex-col gap-3", DASHBOARD_GUTTER)}>
				<div className="flex flex-wrap items-end justify-between gap-2">
					<div className="flex flex-col gap-2">
						<Skeleton variant="text" className="h-4.5 w-32" />
						<Skeleton variant="text" className="h-3.5 w-56" />
					</div>
					<Skeleton className="h-8 w-32" />
				</div>
				<StatCardsSkeleton count={ADMIN_SALES_KPIS.length} columns={4} className="lg:grid-cols-4" />
				<ChartSkeleton withControls={false} />
			</div>
			<div className={cn("flex flex-col gap-2", DASHBOARD_GUTTER)}>
				<Skeleton variant="text" className="h-4.5 w-40" />
				<Skeleton variant="text" className="h-3.5 w-80 max-w-full" />
			</div>
			{DASHBOARD_FIRST_SECTION_HEIGHTS.map((section) => (
				<SectionBones key={section.key} height={section.height} />
			))}
		</SkeletonRegion>
	);
}
