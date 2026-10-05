"use client";

import { AnalyticsKpiGrid } from "@workspace/client/lib/analytics/analytics-kpi-grid";
import {
	ANALYTICS_CHART_LABELS,
	analyticsDisplayRegion,
	analyticsFormatters,
	bucketFormatters,
	formatPreviousPeriodLabel,
	MONEY_AXIS_WIDTH_PX,
	toChartFrameState,
	toChartSeriesData,
	toKpiViews,
	type AnalyticsDataStatus,
} from "@workspace/client/lib/analytics/analytics-presentation";
import { useAuth } from "@workspace/client/lib/auth";
import { Can } from "@workspace/client/lib/auth/can";
import { DEFAULT_SALE_CURRENCY, PERMISSION, PLATFORM_DISPLAY_REGION, UTC_TIME_ZONE, type AdminAnalyticsDashboardQuery } from "@workspace/shared";
import { AnalyticsPanel } from "@workspace/ui/components/analytics/analytics-panel";
import { TimeSeriesChart } from "@workspace/ui/components/analytics/time-series-chart";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { ADMIN_SALES_KPIS, ADMIN_SALES_SERIES } from "@/lib/analytics/admin-analytics";
import { ROUTES } from "@/lib/routes";

/** No range — the API's default (the last 30 days), the analytics page's default preset too. */
const DEFAULT_RANGE_QUERY: AdminAnalyticsDashboardQuery = {};

function PlatformSalesCardsContent(): React.JSX.Element {
	const { api } = useAuth();
	const dashboardQuery = api.rewardsAdmin.analyticsDashboard.useQuery(DEFAULT_RANGE_QUERY);
	const dashboard = dashboardQuery.data?.data;
	const { refetch } = dashboardQuery;

	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);

	const status: AnalyticsDataStatus =
		dashboard !== undefined
			? { status: "ready" }
			: dashboardQuery.isError
				? { status: "error", message: "Couldn't load platform sales.", onRetry: handleRetry }
				: { status: "loading" };
	const formatters = analyticsFormatters(dashboard?.currency ?? DEFAULT_SALE_CURRENCY, PLATFORM_DISPLAY_REGION.locale);
	const region = analyticsDisplayRegion(dashboard?.range.timeZone ?? UTC_TIME_ZONE);
	const buckets = bucketFormatters(dashboard?.range.interval ?? "day", region);
	const sales = toChartSeriesData(dashboard?.series ?? [], ADMIN_SALES_SERIES);

	return (
		<section aria-labelledby="platform-sales-heading" className="space-y-3 px-4 lg:px-6">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h2 id="platform-sales-heading" className="text-base font-semibold tracking-tight text-foreground">
						Platform sales
					</h2>
					<p className="text-sm text-muted-foreground">Last 30 days, vs the 30 days before</p>
				</div>
				<Link href={ROUTES.analytics.index} className={buttonVariants({ variant: "ghost", size: "sm" })}>
					View analytics
					<ArrowRight aria-hidden="true" />
				</Link>
			</div>
			<AnalyticsKpiGrid
				label="Platform sales"
				kpis={toKpiViews(ADMIN_SALES_KPIS, dashboard?.totals, formatters)}
				comparisonLabel={dashboard === undefined ? undefined : formatPreviousPeriodLabel(dashboard.range, region)}
			/>
			<AnalyticsPanel title="Sales per day" description="Paid bill totals, last 30 days">
				<TimeSeriesChart
					title="Sales per day"
					kind="bar"
					points={sales.points}
					series={ADMIN_SALES_SERIES}
					formatValue={formatters.money}
					formatAxisValue={formatters.moneyCompact}
					formatBucketTick={buckets.tick}
					formatBucketLabel={buckets.label}
					labels={ANALYTICS_CHART_LABELS}
					axisWidth={MONEY_AXIS_WIDTH_PX}
					state={toChartFrameState(status, sales.isEmpty, "No paid bills in the last 30 days.")}
				/>
			</AnalyticsPanel>
		</section>
	);
}

/**
 * Overview headline: platform sales for the last 30 days from
 * `GET /admin/analytics/dashboard` (READ ANALYTICS) — the sales KPIs and the
 * daily sales chart, from one query. The overview page itself is open to every
 * admin, so the section is hidden — and never queried — without that permission.
 */
export function PlatformSalesCards(): React.JSX.Element {
	return (
		<Can permission={PERMISSION.ANALYTICS.READ}>
			<PlatformSalesCardsContent />
		</Can>
	);
}
