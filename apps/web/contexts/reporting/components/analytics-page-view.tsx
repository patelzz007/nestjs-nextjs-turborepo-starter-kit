"use client";

import {
	CUSTOMER_ENGAGEMENT_SERIES,
	CUSTOMER_REFERRAL_KPIS,
	CUSTOMER_REWARD_KPIS,
	CUSTOMER_SPENDING_KPIS,
	CUSTOMER_SPENDING_SERIES,
	toCategoryItems,
	toClaimStatusSegments,
	toShopItems,
	toShopTrend,
	type ShopTrend,
} from "@/contexts/reporting/lib/customer-analytics";
import { ROUTES } from "@/lib/routes";
import { keepPreviousData } from "@tanstack/react-query";
import { AnalyticsKpiGrid } from "@workspace/client/lib/contexts/reporting/analytics-kpi-grid";
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
} from "@workspace/client/lib/contexts/reporting/analytics-presentation";
import { analyticsPrefetchKey, toAnalyticsRangeQuery, type AnalyticsRangeQuery } from "@workspace/client/lib/contexts/reporting/analytics-range";
import { useAnalyticsRange } from "@workspace/client/lib/contexts/reporting/analytics-range-controller";
import { AnalyticsRangePickerSkeleton } from "@workspace/ui/components/analytics-range-picker-skeleton";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import {
	CustomerAnalyticsDashboardQuerySchema,
	DEFAULT_SALE_CURRENCY,
	PLATFORM_DISPLAY_REGION,
	UTC_TIME_ZONE,
	type CustomerAnalyticsDashboard,
	type Envelope,
} from "@workspace/shared";
import { AnalyticsPanel } from "@workspace/ui/components/analytics-panel";
import { RankedBarList } from "@workspace/ui/components/ranked-bar-list";
import { ShareBar } from "@workspace/ui/components/share-bar";
import { TimeSeriesChart } from "@workspace/ui/components/time-series-chart";
import { AnalyticsPageHeader } from "@workspace/ui/components/analytics-page-header";
import { buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty";
import { Receipt } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import * as React from "react";

function renderRangeControlsSkeleton(): React.JSX.Element {
	return <AnalyticsRangePickerSkeleton />;
}

/** The range picker and its calendar (`react-day-picker`) in their own chunk; it still renders on the server (rules/19, T43). */
const AnalyticsRangeControls = dynamic(() => import("@workspace/client/lib/contexts/reporting/analytics-range-controls").then((module) => module.AnalyticsRangeControls), {
	loading: renderRangeControlsSkeleton,
});

/** A customer's activity is cut in UTC days (`range.timeZone`) — they spend across merchants and zones. */
const CUSTOMER_REPORT_TIME_ZONE = UTC_TIME_ZONE;

const NO_TREND: ShopTrend = { series: [], points: [], isEmpty: true };

export interface DashboardAnalyticsPageViewProps {
	/** The request time the server page resolved the range with — the client resolves the same range from it. */
	readonly nowMs: number;
	/** The server prefetch and the exact request it answered. */
	readonly initialDashboard?: PrefetchedQuery<Envelope<CustomerAnalyticsDashboard>> | undefined;
}

/** "My Activity": where the customer spent and the rewards they claimed and redeemed, for any range (URL state). No export. */
export function DashboardAnalyticsPageView({ nowMs, initialDashboard }: DashboardAnalyticsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const controller = useAnalyticsRange(nowMs, CUSTOMER_REPORT_TIME_ZONE);
	const rangeQuery = React.useMemo((): AnalyticsRangeQuery => toAnalyticsRangeQuery(controller.range), [controller.range]);
	const input = React.useMemo(() => CustomerAnalyticsDashboardQuerySchema.parse(rangeQuery), [rangeQuery]);
	const prefetched = prefetchedDataFor(initialDashboard, analyticsPrefetchKey(rangeQuery));
	const dashboardQuery = api.claims.analyticsDashboard.useQuery(input, { ...initialDataOption(prefetched), placeholderData: keepPreviousData });

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
			: { status: "error", message: "Your activity is unavailable right now. Try again in a moment.", onRetry: handleRetry };
	}, [dashboard, dashboardQuery.error, handleRetry]);

	return (
		<div className="space-y-6">
			<AnalyticsPageHeader title="My Activity" description="Where you spent, and the rewards you claimed and redeemed." />
			<AnalyticsRangeControls controller={controller} />
			<div
				aria-busy={dashboardQuery.isPlaceholderData || dashboardQuery.isFetching}
				className={cn("space-y-6 transition-opacity motion-reduce:transition-none", dashboardQuery.isPlaceholderData && "opacity-60")}>
				<CustomerActivitySections dashboard={dashboard} status={status} />
			</div>
		</div>
	);
}

export interface CustomerActivitySectionsProps {
	/** `undefined` until the first answer. */
	readonly dashboard: CustomerAnalyticsDashboard | undefined;
	readonly status: AnalyticsDataStatus;
}

const NO_SPENDING_MESSAGE = "No spending in this range. Spending shows up after you redeem a reward at a participating shop.";

/** The dashboard body. Purely presentational. */
export function CustomerActivitySections({ dashboard, status }: CustomerActivitySectionsProps): React.JSX.Element {
	const formatters = React.useMemo(
		(): AnalyticsFormatters => analyticsFormatters(dashboard?.currency ?? DEFAULT_SALE_CURRENCY, PLATFORM_DISPLAY_REGION.locale),
		[dashboard?.currency],
	);
	const region = analyticsDisplayRegion(dashboard?.range.timeZone ?? CUSTOMER_REPORT_TIME_ZONE);
	const buckets = bucketFormatters(dashboard?.range.interval ?? "day", region);
	const comparisonLabel = dashboard === undefined ? undefined : formatPreviousPeriodLabel(dashboard.range, region);
	const series = dashboard?.series ?? [];
	const spending = toChartSeriesData(series, CUSTOMER_SPENDING_SERIES);
	const engagement = toChartSeriesData(series, CUSTOMER_ENGAGEMENT_SERIES);
	const shopTrend = dashboard === undefined ? NO_TREND : toShopTrend(dashboard);
	const hasNoSpending = dashboard?.spendingByMerchant.length === 0;
	const claimStatuses = dashboard === undefined ? [] : toClaimStatusSegments(dashboard, formatters);
	const hasClaims = claimStatuses.some((segment) => segment.value > 0);

	return (
		<>
			<AnalyticsKpiGrid label="Your spending" kpis={toKpiViews(CUSTOMER_SPENDING_KPIS, dashboard?.totals, formatters)} comparisonLabel={comparisonLabel} />
			<AnalyticsKpiGrid
				label="Your rewards"
				kpis={toKpiViews(CUSTOMER_REWARD_KPIS, dashboard?.totals, formatters)}
				comparisonLabel={comparisonLabel}
				className="lg:grid-cols-3"
			/>
			<AnalyticsKpiGrid
				label="Your referrals"
				kpis={toKpiViews(CUSTOMER_REFERRAL_KPIS, dashboard?.totals, formatters)}
				comparisonLabel={comparisonLabel}
				className="lg:grid-cols-3"
			/>

			{hasNoSpending ? (
				<Empty className="border bg-card">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Receipt className="size-5" aria-hidden="true" />
						</EmptyMedia>
						<EmptyTitle role="heading" aria-level={2}>
							No spending yet
						</EmptyTitle>
						<EmptyDescription>Spending shows up after you redeem a reward at a participating shop.</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Link href={ROUTES.dashboard.browse} className={buttonVariants({ variant: "outline" })}>
							Browse rewards
						</Link>
					</EmptyContent>
				</Empty>
			) : null}

			<div className="grid gap-6 xl:grid-cols-2">
				<AnalyticsPanel title="Spending over time" description="What you paid at participating shops, per period">
					<TimeSeriesChart
						title="Spending over time"
						kind="bar"
						points={spending.points}
						series={CUSTOMER_SPENDING_SERIES}
						formatValue={formatters.money}
						formatAxisValue={formatters.moneyCompact}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						axisWidth={MONEY_AXIS_WIDTH_PX}
						state={toChartFrameState(status, spending.isEmpty, NO_SPENDING_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Claimed vs redeemed" description="Rewards you claimed and redeemed, per period">
					<TimeSeriesChart
						title="Claimed vs redeemed"
						kind="line"
						points={engagement.points}
						series={CUSTOMER_ENGAGEMENT_SERIES}
						formatValue={formatters.count}
						formatAxisValue={formatters.count}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						state={toChartFrameState(status, engagement.isEmpty, "You didn't claim or redeem a reward in this range.")}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Your claims by status" description="Rewards you claimed in this range, by where they stand now" className="xl:col-span-2">
					<ShareBar label="Claims by status" segments={claimStatuses} state={toChartFrameState(status, !hasClaims, "You didn't claim a reward in this range.")} />
				</AnalyticsPanel>
			</div>

			<div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
				<AnalyticsPanel title="Where you spent the most" description="Your top shops in this range">
					<RankedBarList
						label="Shops ranked by your spending"
						tone="ranked"
						showRank
						items={dashboard === undefined ? [] : toShopItems(dashboard, formatters)}
						state={toChartFrameState(status, hasNoSpending, NO_SPENDING_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="What you spent on" description="Your spending by type of shop">
					<RankedBarList
						label="Shop categories ranked by your spending"
						items={dashboard === undefined ? [] : toCategoryItems(dashboard, formatters)}
						state={toChartFrameState(status, dashboard?.spendingByCategory.length === 0, NO_SPENDING_MESSAGE)}
					/>
				</AnalyticsPanel>
				<AnalyticsPanel title="Your top shops over time" description="Spending at your three top shops, per period" className="lg:col-span-2 2xl:col-span-1">
					<TimeSeriesChart
						title="Your top shops over time"
						kind="line"
						points={shopTrend.points}
						series={shopTrend.series}
						formatValue={formatters.money}
						formatAxisValue={formatters.moneyCompact}
						formatBucketTick={buckets.tick}
						formatBucketLabel={buckets.label}
						axisWidth={MONEY_AXIS_WIDTH_PX}
						state={toChartFrameState(status, shopTrend.isEmpty, NO_SPENDING_MESSAGE)}
					/>
				</AnalyticsPanel>
			</div>
		</>
	);
}
