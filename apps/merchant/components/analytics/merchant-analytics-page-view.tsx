"use client";

import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantLocationScopeBanner } from "@/components/layout/merchant-location-scope-banner";
import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { useActiveLocationFilter } from "@/features/tenant-context/facade";
import {
	MERCHANT_AVERAGE_BILL_SERIES,
	MERCHANT_BILLS_SERIES,
	MERCHANT_ENGAGEMENT_SERIES,
	MERCHANT_REWARD_KPIS,
	MERCHANT_SALES_KPIS,
	MERCHANT_SALES_SERIES,
	toRedemptionMethodSegments,
	toRewardItems,
	toStoreItems,
} from "@/lib/analytics/merchant-analytics";
import { orgRoutes } from "@/lib/routes";
import { keepPreviousData } from "@tanstack/react-query";
import { AnalyticsExportMenu } from "@workspace/client/lib/analytics/analytics-export-menu";
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
	type AnalyticsFormatters,
} from "@workspace/client/lib/analytics/analytics-presentation";
import { analyticsPrefetchKey, toAnalyticsRangeQuery, type AnalyticsRangeQuery } from "@workspace/client/lib/analytics/analytics-range";
import { AnalyticsRangeControls, useAnalyticsRange } from "@workspace/client/lib/analytics/analytics-range-controls";
import { apiDownloads } from "@workspace/client/lib/api/download";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import {
	DEFAULT_SALE_CURRENCY,
	MERCHANT_CAPABILITY,
	MerchantAnalyticsDashboardQuerySchema,
	MerchantAnalyticsExportQuerySchema,
	PLATFORM_DISPLAY_REGION,
	type AnalyticsExportFormat,
	type Envelope,
	type MerchantAnalyticsDashboard,
} from "@workspace/shared";
import { AnalyticsPanel } from "@workspace/ui/components/analytics/analytics-panel";
import { RankedBarList } from "@workspace/ui/components/analytics/ranked-bar-list";
import { ShareBar } from "@workspace/ui/components/analytics/share-bar";
import { TimeSeriesChart } from "@workspace/ui/components/analytics/time-series-chart";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Receipt } from "lucide-react";
import Link from "next/link";
import * as React from "react";

export interface MerchantAnalyticsPageViewProps {
	readonly orgSlug: string;
	/** The request time the server page resolved the range with — the client resolves the same range from it. */
	readonly nowMs: number;
	/** The organization's report zone (`range.timeZone`) as the server learned it; days are cut in it. */
	readonly timeZone: string;
	/** The server prefetch and the exact request (range + store) it answered. */
	readonly initialDashboard?: PrefetchedQuery<Envelope<MerchantAnalyticsDashboard>> | undefined;
}

/** Analytics route — requires `merchant:view_analytics` (dashboard and export); the query mounts only when allowed. */
export function MerchantAnalyticsPageView(props: MerchantAnalyticsPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewAnalytics}>
			<MerchantAnalyticsContent {...props} />
		</MerchantCapabilityGate>
	);
}

/** The store part of the prefetch key: the `locationId` query input (`""` = every store in scope). */
function storeScope(locationId: string | undefined): string {
	return locationId ?? "";
}

function MerchantAnalyticsContent({ orgSlug, nowMs, timeZone, initialDashboard }: MerchantAnalyticsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const { locationId } = useActiveLocationFilter();
	const controller = useAnalyticsRange(nowMs, timeZone);
	const rangeQuery = React.useMemo((): AnalyticsRangeQuery => toAnalyticsRangeQuery(controller.range), [controller.range]);
	const input = React.useMemo(() => MerchantAnalyticsDashboardQuerySchema.parse({ ...rangeQuery, locationId }), [rangeQuery, locationId]);
	// Seed only with what the server fetched for this exact range AND store — never another store's numbers under this key.
	const prefetched = prefetchedDataFor(initialDashboard, analyticsPrefetchKey(rangeQuery, storeScope(locationId)));
	const dashboardQuery = api.organizations.analyticsDashboard.useQuery({ orgSlug, ...input }, { ...initialDataOption(prefetched), placeholderData: keepPreviousData });

	const dashboard = dashboardQuery.data?.data;
	const { refetch } = dashboardQuery;
	const handleRetry = React.useCallback((): void => {
		void refetch();
	}, [refetch]);
	const status = React.useMemo((): AnalyticsDataStatus => {
		if (dashboard !== undefined) {
			return { status: "ready" };
		}
		return dashboardQuery.error === null
			? { status: "loading" }
			: { status: "error", message: "Your analytics are unavailable right now. Try again in a moment.", onRetry: handleRetry };
	}, [dashboard, dashboardQuery.error, handleRetry]);

	// The export reads the same range, interval and store as the screen; the API re-checks the member's store scope.
	const exportInputFor = React.useCallback(
		(format: AnalyticsExportFormat) => ({ orgSlug, ...MerchantAnalyticsExportQuerySchema.parse({ ...rangeQuery, locationId, format }) }),
		[orgSlug, rangeQuery, locationId],
	);
	// The empty sales state links to API keys only for members who may create one (POST /orgs/:orgSlug/api-keys).
	const apiKeysHref = can(MERCHANT_CAPABILITY.manageApiKeys) ? orgRoutes(orgSlug).apiKeys : undefined;

	return (
		<div className="space-y-6">
			<AnalyticsPageHeader
				title="Analytics"
				description="Sales, customers and reward performance across your stores."
				actions={<AnalyticsExportMenu definition={apiDownloads.organizations.analyticsExport} inputFor={exportInputFor} />}
			/>
			<MerchantLocationScopeBanner
				filteredNote="Every number, chart and export below is for this store."
				allStoresNote="Showing combined numbers for every store you can access. Pick a store in the top bar to narrow them."
			/>
			<AnalyticsRangeControls controller={controller} />
			<div
				aria-busy={dashboardQuery.isPlaceholderData || dashboardQuery.isFetching}
				className={cn("space-y-6 transition-opacity motion-reduce:transition-none", dashboardQuery.isPlaceholderData && "opacity-60")}>
				{dashboard?.firstBillAt === null ? <NoSalesYet apiKeysHref={apiKeysHref} /> : null}
				<MerchantAnalyticsSections dashboard={dashboard} status={status} timeZone={timeZone} />
			</div>
		</div>
	);
}

/** The POS has never reported a bill in this scope — explain how sales start flowing in. */
function NoSalesYet({ apiKeysHref }: { readonly apiKeysHref: string | undefined }): React.JSX.Element {
	return (
		<MerchantEmptyState
			title="No sales yet"
			description={
				apiKeysHref === undefined
					? "Sales appear once your POS reports bills through the checkout API. Ask your store owner to connect your POS."
					: "Sales appear once your POS reports bills through the checkout API."
			}
			icon={<Receipt className="size-5" aria-hidden="true" />}
			{...(apiKeysHref === undefined
				? {}
				: {
						action: (
							<Link href={apiKeysHref} className={buttonVariants({ variant: "outline" })}>
								Set up API keys
							</Link>
						),
					})}
		/>
	);
}

export interface MerchantAnalyticsSectionsProps {
	/** `undefined` until the first answer. */
	readonly dashboard: MerchantAnalyticsDashboard | undefined;
	readonly status: AnalyticsDataStatus;
	/** The report zone until the answer names it. */
	readonly timeZone: string;
}

const NO_SALES_MESSAGE = "No paid bills in this range.";

/** The dashboard body: KPI groups, the time series and the breakdowns. Purely presentational. */
export function MerchantAnalyticsSections({ dashboard, status, timeZone }: MerchantAnalyticsSectionsProps): React.JSX.Element {
	const formatters = React.useMemo(
		(): AnalyticsFormatters => analyticsFormatters(dashboard?.currency ?? DEFAULT_SALE_CURRENCY, PLATFORM_DISPLAY_REGION.locale),
		[dashboard?.currency],
	);
	const region = analyticsDisplayRegion(dashboard?.range.timeZone ?? timeZone);
	const buckets = bucketFormatters(dashboard?.range.interval ?? "day", region);
	const comparisonLabel = dashboard === undefined ? undefined : formatPreviousPeriodLabel(dashboard.range, region);
	const series = dashboard?.series ?? [];

	const sales = toChartSeriesData(series, MERCHANT_SALES_SERIES);
	const bills = toChartSeriesData(series, MERCHANT_BILLS_SERIES);
	const averageBill = toChartSeriesData(series, MERCHANT_AVERAGE_BILL_SERIES);
	const engagement = toChartSeriesData(series, MERCHANT_ENGAGEMENT_SERIES);
	const methods = dashboard === undefined ? [] : toRedemptionMethodSegments(dashboard, formatters);
	const hasRedemptions = methods.some((segment) => segment.value > 0);

	return (
		<>
			<AnalyticsKpiGrid label="Sales" kpis={toKpiViews(MERCHANT_SALES_KPIS, dashboard?.totals, formatters)} comparisonLabel={comparisonLabel} />
			<AnalyticsKpiGrid label="Rewards" kpis={toKpiViews(MERCHANT_REWARD_KPIS, dashboard?.totals, formatters)} comparisonLabel={comparisonLabel} className="lg:grid-cols-3" />

			<div className="grid gap-6 xl:grid-cols-2">
				<AnalyticsPanel title="Sales over time" description="Paid bill totals per period">
					<TimeSeriesChart
						title="Sales over time"
						kind="bar"
						points={sales.points}
						series={MERCHANT_SALES_SERIES}
						formatValue={formatters.money}
						formatAxisValue={formatters.moneyCompact}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						labels={ANALYTICS_CHART_LABELS}
						axisWidth={MONEY_AXIS_WIDTH_PX}
						state={toChartFrameState(status, sales.isEmpty, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Bills over time" description="Paid bills per period">
					<TimeSeriesChart
						title="Bills over time"
						kind="bar"
						points={bills.points}
						series={MERCHANT_BILLS_SERIES}
						formatValue={formatters.count}
						formatAxisValue={formatters.count}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						labels={ANALYTICS_CHART_LABELS}
						state={toChartFrameState(status, bills.isEmpty, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Average bill" description="Average paid bill per period">
					<TimeSeriesChart
						title="Average bill"
						kind="line"
						points={averageBill.points}
						series={MERCHANT_AVERAGE_BILL_SERIES}
						formatValue={formatters.money}
						formatAxisValue={formatters.moneyCompact}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						labels={ANALYTICS_CHART_LABELS}
						axisWidth={MONEY_AXIS_WIDTH_PX}
						state={toChartFrameState(status, averageBill.isEmpty, NO_SALES_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Claims and redemptions" description="Your rewards claimed and redeemed per period">
					<TimeSeriesChart
						title="Claims and redemptions"
						kind="line"
						points={engagement.points}
						series={MERCHANT_ENGAGEMENT_SERIES}
						formatValue={formatters.count}
						formatAxisValue={formatters.count}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						labels={ANALYTICS_CHART_LABELS}
						state={toChartFrameState(status, engagement.isEmpty, "No claims or redemptions in this range.")}
					/>
				</AnalyticsPanel>
			</div>

			<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
				<AnalyticsPanel title="By store" description="Sales at each store in your view">
					<RankedBarList
						label="Stores ranked by sales"
						items={dashboard === undefined ? [] : toStoreItems(dashboard, formatters)}
						state={toChartFrameState(status, dashboard?.byStore.length === 0, "No stores in your view.")}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="By reward" description="Your most claimed rewards and how many were redeemed">
					<RankedBarList
						label="Rewards ranked by claims"
						tone="ranked"
						showRank
						items={dashboard === undefined ? [] : toRewardItems(dashboard, formatters)}
						state={toChartFrameState(status, dashboard?.byReward.length === 0, "No reward activity in this range.")}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="By redemption method" description="How customers redeemed at the till">
					<ShareBar label="Redemptions by method" segments={methods} state={toChartFrameState(status, !hasRedemptions, "No redemptions in this range.")} />
				</AnalyticsPanel>
			</div>
		</>
	);
}
