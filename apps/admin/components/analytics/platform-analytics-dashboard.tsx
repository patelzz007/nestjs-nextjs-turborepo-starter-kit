"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { AnalyticsExportMenu } from "@workspace/client/lib/analytics/analytics-export-menu";
import { AnalyticsKpiGrid } from "@workspace/client/lib/analytics/analytics-kpi-grid";
import {
	analyticsDisplayRegion,
	analyticsFormatters,
	bucketFormatters,
	formatPreviousPeriodLabel,
	MONEY_AXIS_WIDTH_PX,
	toChartFrameState,
	toChartSeriesData,
	toKpiViews,
	type AnalyticsDataStatus,
	type AnalyticsFormatters,
} from "@workspace/client/lib/analytics/analytics-presentation";
import { analyticsPrefetchKey, toAnalyticsRangeQuery, type AnalyticsRangeQuery } from "@workspace/client/lib/analytics/analytics-range";
import { AnalyticsRangeControls, useAnalyticsRange } from "@workspace/client/lib/analytics/analytics-range-controls";
import { apiDownloads } from "@workspace/client/lib/api/download";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import {
	AdminAnalyticsDashboardQuerySchema,
	AdminAnalyticsExportQuerySchema,
	DEFAULT_SALE_CURRENCY,
	PLATFORM_DISPLAY_REGION,
	UTC_TIME_ZONE,
	type AdminAnalyticsDashboard,
	type AdminAnalyticsExportQuery,
	type AnalyticsExportFormat,
	type Envelope,
} from "@workspace/shared";
import { AnalyticsPanel, type ChartFrameState } from "@workspace/ui/components/analytics-panel";
import { RankedBarList } from "@workspace/ui/components/ranked-bar-list";
import { TimeSeriesChart } from "@workspace/ui/components/time-series-chart";
import { AnalyticsPageHeader } from "@workspace/ui/components/analytics-page-header";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

import {
	ADMIN_BILLS_SERIES,
	ADMIN_CUSTOMER_KPIS,
	ADMIN_CUSTOMER_SERIES,
	ADMIN_ENGAGEMENT_SERIES,
	ADMIN_REWARD_KPIS,
	ADMIN_SALES_KPIS,
	ADMIN_SALES_SERIES,
	toCategoryItems,
	toCityItems,
	toTopMerchantItems,
} from "@/lib/analytics/admin-analytics";

/** Platform analytics are cut in UTC days (`range.timeZone`), one view across merchants in every zone. */
const ADMIN_REPORT_TIME_ZONE = UTC_TIME_ZONE;

export interface PlatformAnalyticsDashboardProps {
	/** The request time the server page resolved the range with — the client resolves the same range from it. */
	readonly nowMs: number;
	/** The server prefetch and the exact request it answered (`analyticsPrefetchKey`). */
	readonly initialDashboard?: PrefetchedQuery<Envelope<AdminAnalyticsDashboard>> | undefined;
}

/**
 * Smart component of `/analytics` (READ ANALYTICS — the route guard checks
 * it): owns the URL range, the dashboard query and the export. Changing the
 * range keeps the previous numbers on screen, dimmed, until the new ones land.
 */
export function PlatformAnalyticsDashboard({ nowMs, initialDashboard }: PlatformAnalyticsDashboardProps): React.JSX.Element {
	const { api } = useAuth();
	const controller = useAnalyticsRange(nowMs, ADMIN_REPORT_TIME_ZONE);
	const rangeQuery = React.useMemo((): AnalyticsRangeQuery => toAnalyticsRangeQuery(controller.range), [controller.range]);
	const input = React.useMemo(() => AdminAnalyticsDashboardQuerySchema.parse(rangeQuery), [rangeQuery]);
	const prefetched = prefetchedDataFor(initialDashboard, analyticsPrefetchKey(rangeQuery));
	const dashboardQuery = api.rewardsAdmin.analyticsDashboard.useQuery(input, { ...initialDataOption(prefetched), placeholderData: keepPreviousData });

	const dashboard = dashboardQuery.data?.data;
	const { refetch } = dashboardQuery;
	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);
	const status = React.useMemo((): AnalyticsDataStatus => {
		if (dashboard !== undefined) {
			return { status: "ready" };
		}
		return dashboardQuery.error === null ? { status: "loading" } : { status: "error", message: dashboardQuery.error.message, onRetry: handleRetry };
	}, [dashboard, dashboardQuery.error, handleRetry]);

	const exportInputFor = React.useCallback(
		(format: AnalyticsExportFormat): AdminAnalyticsExportQuery => AdminAnalyticsExportQuerySchema.parse({ ...rangeQuery, format }),
		[rangeQuery],
	);

	return (
		<div className="space-y-6">
			<AnalyticsPageHeader
				title="Analytics"
				description="Sales, customers and reward activity across the platform."
				actions={<AnalyticsExportMenu definition={apiDownloads.rewardsAdmin.analyticsExport} inputFor={exportInputFor} />}
			/>
			<AnalyticsRangeControls controller={controller} />
			<div
				aria-busy={dashboardQuery.isPlaceholderData || dashboardQuery.isFetching}
				className={cn("space-y-6 transition-opacity motion-reduce:transition-none", dashboardQuery.isPlaceholderData && "opacity-60")}>
				<PlatformAnalyticsSections dashboard={dashboard} status={status} />
			</div>
		</div>
	);
}

export interface PlatformAnalyticsSectionsProps {
	/** `undefined` until the first answer. */
	readonly dashboard: AdminAnalyticsDashboard | undefined;
	readonly status: AnalyticsDataStatus;
}

const NO_SALES_MESSAGE = "No paid bills in this range. Bills appear once merchants' POS systems report them.";

/** The dashboard body: KPI groups, the time series and the breakdowns. Purely presentational. */
export function PlatformAnalyticsSections({ dashboard, status }: PlatformAnalyticsSectionsProps): React.JSX.Element {
	const formatters = React.useMemo(
		(): AnalyticsFormatters => analyticsFormatters(dashboard?.currency ?? DEFAULT_SALE_CURRENCY, PLATFORM_DISPLAY_REGION.locale),
		[dashboard?.currency],
	);
	const region = analyticsDisplayRegion(dashboard?.range.timeZone ?? ADMIN_REPORT_TIME_ZONE);
	const buckets = bucketFormatters(dashboard?.range.interval ?? "day", region);
	const comparisonLabel = dashboard === undefined ? undefined : formatPreviousPeriodLabel(dashboard.range, region);
	const series = dashboard?.series ?? [];

	const sales = toChartSeriesData(series, ADMIN_SALES_SERIES);
	const bills = toChartSeriesData(series, ADMIN_BILLS_SERIES);
	const engagement = toChartSeriesData(series, ADMIN_ENGAGEMENT_SERIES);
	const customers = toChartSeriesData(series, ADMIN_CUSTOMER_SERIES);
	const breakdownState = (isEmpty: boolean, message: string): ChartFrameState => toChartFrameState(status, isEmpty, message);

	return (
		<>
			<AnalyticsKpiGrid label="Sales" kpis={toKpiViews(ADMIN_SALES_KPIS, dashboard?.totals, formatters)} comparisonLabel={comparisonLabel} />
			<AnalyticsKpiGrid label="Customers" kpis={toKpiViews(ADMIN_CUSTOMER_KPIS, dashboard?.totals, formatters)} comparisonLabel={comparisonLabel} className="lg:grid-cols-3" />
			<AnalyticsKpiGrid label="Rewards" kpis={toKpiViews(ADMIN_REWARD_KPIS, dashboard?.totals, formatters)} comparisonLabel={comparisonLabel} className="lg:grid-cols-3" />

			<div className="grid gap-6 xl:grid-cols-2">
				<AnalyticsPanel title="Sales over time" description="Paid bill totals per period">
					<TimeSeriesChart
						title="Sales over time"
						kind="bar"
						points={sales.points}
						series={ADMIN_SALES_SERIES}
						formatValue={formatters.money}
						formatAxisValue={formatters.moneyCompact}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						axisWidth={MONEY_AXIS_WIDTH_PX}
						state={breakdownState(sales.isEmpty, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Bills over time" description="Paid bills per period">
					<TimeSeriesChart
						title="Bills over time"
						kind="bar"
						points={bills.points}
						series={ADMIN_BILLS_SERIES}
						formatValue={formatters.count}
						formatAxisValue={formatters.count}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						state={breakdownState(bills.isEmpty, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Claims and redemptions" description="Rewards claimed and redeemed per period">
					<TimeSeriesChart
						title="Claims and redemptions"
						kind="line"
						points={engagement.points}
						series={ADMIN_ENGAGEMENT_SERIES}
						formatValue={formatters.count}
						formatAxisValue={formatters.count}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						state={breakdownState(engagement.isEmpty, "No claims or redemptions in this range.")}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="New vs returning customers" description="Paying customers per period: first bill ever, or back again">
					<TimeSeriesChart
						title="New vs returning customers"
						kind="stackedBar"
						points={customers.points}
						series={ADMIN_CUSTOMER_SERIES}
						formatValue={formatters.count}
						formatAxisValue={formatters.count}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						state={breakdownState(customers.isEmpty, "No paying customers in this range.")}
					/>
				</AnalyticsPanel>
			</div>

			<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
				<AnalyticsPanel title="Top merchants" description="Highest sales in the range" className="lg:col-span-2 2xl:col-span-1">
					<RankedBarList
						label="Merchants ranked by sales"
						tone="ranked"
						showRank
						items={dashboard === undefined ? [] : toTopMerchantItems(dashboard, formatters)}
						state={breakdownState(dashboard?.topMerchants.length === 0, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Sales by category" description="Merchant business categories">
					<RankedBarList
						label="Business categories ranked by sales"
						items={dashboard === undefined ? [] : toCategoryItems(dashboard, formatters)}
						state={breakdownState(dashboard?.byCategory.length === 0, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Sales by city" description="Where the bills were paid">
					<RankedBarList
						label="Cities ranked by sales"
						items={dashboard === undefined ? [] : toCityItems(dashboard, formatters)}
						state={breakdownState(dashboard?.byCity.length === 0, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
			</div>
		</>
	);
}
