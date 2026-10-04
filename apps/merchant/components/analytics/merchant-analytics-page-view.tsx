"use client";

import { MerchantCapabilityGate } from "@/components/access/merchant-capability-gate";
import { MerchantSalesSection } from "@/components/analytics/merchant-sales-section";
import { MerchantLocationScopeBanner } from "@/components/layout/merchant-location-scope-banner";
import { initialDataOption } from "@workspace/client/lib/api/envelope";
import { useActiveLocationFilter } from "@/features/tenant-context/facade";
import { prefetchForLocation, type LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { orgRoutes } from "@/lib/routes";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import {
	ANALYTICS_BUCKET_DISPLAY_REGION,
	analyticsBucketRegion,
	DEFAULT_ANALYTICS_WEEKS,
	MERCHANT_CAPABILITY,
	PLATFORM_DISPLAY_REGION,
	WEEK_MS,
	type AnalyticsMetric,
	type Envelope,
	type MerchantAnalyticsResponse,
} from "@workspace/shared";
import { AnalyticsChartCard, AnalyticsChartLegendItem } from "@workspace/ui/components/display/analytics-chart-card";
import { AnalyticsFunnel, type AnalyticsFunnelStep } from "@workspace/ui/components/display/analytics-funnel";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { AnalyticsStatCard, type AnalyticsStatAccent } from "@workspace/ui/components/display/analytics-stat-card";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { formatEpochMs } from "@workspace/ui/lib/format/date-time";
import { formatCount } from "@workspace/ui/lib/format/number";
import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import { ANALYTICS_CHART_HEIGHT_CLASS } from "@/lib/analytics/chart-layout";
import { Button } from "@workspace/ui/components/form/button";
import { AlertCircle, BarChart3, Tag, TrendingUp, Users, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const CLAIMS_CHART_CONFIG: ChartConfig = {
	claims: { label: "Claims", color: "var(--chart-1)" },
	redemptions: { label: "Redemptions", color: "var(--chart-2)" },
};

const TOP_REWARDS_CHART_CONFIG: ChartConfig = {
	claims: { label: "Claims", color: "var(--chart-1)" },
	redemptions: { label: "Redemptions", color: "var(--chart-2)" },
};

/** Longest reward title shown on the top-rewards axis before it is truncated with an ellipsis. */
export const TOP_REWARD_AXIS_LABEL_MAX_CHARS = 15;
/** Width (px) of the top-rewards category axis — fits {@link TOP_REWARD_AXIS_LABEL_MAX_CHARS} characters. */
const TOP_REWARD_AXIS_WIDTH_PX = 108;
/** Width (px) of the claims chart's count axis. */
const COUNT_AXIS_WIDTH_PX = 36;
/** Fill opacity of the claims / redemptions areas. */
const AREA_FILL_OPACITY = 0.18;

/** Weeks an analytics response covers (its echoed period starts on a UTC week boundary, so a partial current week counts as one). */
export function analyticsPeriodWeeks(period: MerchantAnalyticsResponse["period"]): number {
	return Math.max(1, Math.ceil((period.to - period.from) / WEEK_MS));
}

/** The claims chart's subtitle, from the period the API actually answered for. */
export function describeClaimsChartPeriod(period: MerchantAnalyticsResponse["period"] | undefined): string {
	const weeks = period === undefined ? DEFAULT_ANALYTICS_WEEKS : analyticsPeriodWeeks(period);
	return `Weekly performance over the last ${String(weeks)} ${weeks === 1 ? "week" : "weeks"}`;
}

/** A reward title shortened to fit the category axis. */
export function truncateAxisLabel(value: string): string {
	return value.length > TOP_REWARD_AXIS_LABEL_MAX_CHARS ? `${value.slice(0, TOP_REWARD_AXIS_LABEL_MAX_CHARS)}…` : value;
}

interface StatCardDefinition {
	readonly key: keyof Pick<MerchantAnalyticsResponse, "totalRewards" | "activeRewards" | "totalClaims" | "totalRedemptions" | "conversionRate" | "referralCount">;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly accent: AnalyticsStatAccent;
	readonly suffix?: string;
}

const STAT_CARDS: readonly StatCardDefinition[] = [
	{ key: "totalRewards", label: "Total Rewards", icon: Tag, accent: "primary" },
	{ key: "activeRewards", label: "Active Rewards", icon: Tag, accent: "success" },
	{ key: "totalClaims", label: "Total Claims", icon: Users, accent: "info" },
	{ key: "totalRedemptions", label: "Redemptions", icon: BarChart3, accent: "warning" },
	{ key: "conversionRate", label: "Conversion Rate", icon: TrendingUp, accent: "secondary", suffix: "%" },
	{ key: "referralCount", label: "Referrals", icon: Users, accent: "info" },
];

function formatPlatformCount(value: number): string {
	return formatCount(value, PLATFORM_DISPLAY_REGION.locale);
}

function formatMetricValue(metric: AnalyticsMetric, suffix?: string): string {
	const formatted = formatPlatformCount(metric.value);
	return suffix === undefined ? formatted : `${formatted}${suffix}`;
}

export interface MerchantAnalyticsPageViewProps {
	readonly orgSlug: string;
	/** Server-prefetched analytics with the store filter they were fetched for. */
	readonly initialAnalytics?: LocationScopedPrefetch<Envelope<MerchantAnalyticsResponse>> | undefined;
}

/** Analytics route — requires `merchant:view_analytics` (analytics endpoint); the query mounts only when allowed. */
export function MerchantAnalyticsPageView(props: MerchantAnalyticsPageViewProps): React.JSX.Element {
	return (
		<MerchantCapabilityGate capability={MERCHANT_CAPABILITY.viewAnalytics}>
			<MerchantAnalyticsPageViewContent {...props} />
		</MerchantCapabilityGate>
	);
}

function MerchantAnalyticsPageViewContent({ orgSlug, initialAnalytics }: MerchantAnalyticsPageViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const { locationId } = useActiveLocationFilter();
	// The empty sales state links to API keys only for members who may create one (POST /orgs/:orgSlug/api-keys).
	const apiKeysHref = can(MERCHANT_CAPABILITY.manageApiKeys) ? orgRoutes(orgSlug).apiKeys : undefined;

	// Seed only with data the server fetched for this exact filter — never another store's under this key.
	const prefetchedAnalytics = prefetchForLocation(initialAnalytics, locationId);
	const analyticsQuery = api.organizations.analytics.useQuery({ orgSlug, locationId }, initialDataOption(prefetchedAnalytics));

	const analytics = analyticsQuery.data?.data;
	const isLoading = analyticsQuery.isLoading;
	const refetchAnalytics = analyticsQuery.refetch;
	const handleRetry = React.useCallback((): void => {
		void refetchAnalytics();
	}, [refetchAnalytics]);

	// Weekly points are bucketed in the merchant's own zone; label them there (UTC until the response arrives).
	const bucketRegion = React.useMemo(() => (analytics === undefined ? ANALYTICS_BUCKET_DISPLAY_REGION : analyticsBucketRegion(analytics.period)), [analytics]);

	const chartData = React.useMemo(
		() =>
			(analytics?.claimsOverTime ?? []).map((point) => ({
				...point,
				label: formatEpochMs(point.date, "dayMonth", bucketRegion),
			})),
		[analytics?.claimsOverTime, bucketRegion],
	);

	const funnelSteps = React.useMemo(
		(): readonly AnalyticsFunnelStep[] =>
			analytics === undefined
				? []
				: [
						{ label: "Rewards Created", value: formatPlatformCount(analytics.totalRewards.value), accent: "primary" },
						{ label: "Total Claims", value: formatPlatformCount(analytics.totalClaims.value), accent: "info" },
						{ label: "Redemptions", value: formatPlatformCount(analytics.totalRedemptions.value), accent: "success" },
						{ label: "Conversion", value: `${String(analytics.conversionRate.value)}%`, accent: "warning" },
					],
		[analytics],
	);

	return (
		<div className="space-y-8">
			<AnalyticsPageHeader title="Analytics" description="Track your sales, reward performance and customer engagement" />
			<MerchantLocationScopeBanner
				filteredNote="Sales, redemptions and redemption trends are store-specific; reward counts remain organization-wide."
				allStoresNote="Showing combined metrics for every store you can access."
			/>

			{analyticsQuery.isError && analytics === undefined ? (
				<MerchantEmptyState
					title="Could not load analytics"
					description="Your analytics are unavailable right now. Try again in a moment."
					icon={<AlertCircle className="size-5" aria-hidden="true" />}
					action={
						<Button type="button" onClick={handleRetry}>
							Try again
						</Button>
					}
				/>
			) : (
				<>
					<MerchantSalesSection sales={analytics?.sales} isLoading={isLoading} apiKeysHref={apiKeysHref} bucketRegion={bucketRegion} />

					<section aria-labelledby="merchant-rewards-analytics-heading" className="space-y-4">
						<div className="space-y-1">
							<h2 id="merchant-rewards-analytics-heading" className="text-lg font-semibold tracking-tight text-foreground">
								Rewards & engagement
							</h2>
							<p className="text-sm text-muted-foreground">Claims, redemptions and referrals from your rewards.</p>
						</div>

						<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
							{STAT_CARDS.map((stat) => {
								const metric = analytics?.[stat.key];

								return (
									<AnalyticsStatCard
										key={stat.key}
										label={stat.label}
										icon={stat.icon}
										accent={stat.accent}
										{...(metric !== undefined ? { value: formatMetricValue(metric, stat.suffix) } : {})}
										changePercent={metric?.changePercent ?? null}
										isLoading={isLoading || metric === undefined}
									/>
								);
							})}
						</div>

						<div className="grid gap-6 lg:grid-cols-2">
							<AnalyticsChartCard
								title="Claims & Redemptions"
								description={describeClaimsChartPeriod(analytics?.period)}
								isLoading={isLoading}
								legend={
									<>
										<AnalyticsChartLegendItem label="Claims" colorClass="bg-chart-1" />
										<AnalyticsChartLegendItem label="Redemptions" colorClass="bg-chart-2" />
									</>
								}>
								<ChartContainer config={CLAIMS_CHART_CONFIG} className={cn("aspect-auto w-full", ANALYTICS_CHART_HEIGHT_CLASS)}>
									<AreaChart data={chartData}>
										<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
										<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
										<YAxis tickLine={false} axisLine={false} width={COUNT_AXIS_WIDTH_PX} className="text-xs" />
										<ChartTooltip content={<ChartTooltipContent valueFormatter={formatPlatformCount} />} />
										<Area
											dataKey="claims"
											type="monotone"
											fill="var(--color-claims)"
											fillOpacity={AREA_FILL_OPACITY}
											stroke="var(--color-claims)"
											strokeWidth={2}
											stackId="1"
										/>
										<Area
											dataKey="redemptions"
											type="monotone"
											fill="var(--color-redemptions)"
											fillOpacity={AREA_FILL_OPACITY}
											stroke="var(--color-redemptions)"
											strokeWidth={2}
											stackId="2"
										/>
									</AreaChart>
								</ChartContainer>
							</AnalyticsChartCard>

							<AnalyticsChartCard
								title="Top Performing Rewards"
								description="Claims and redemptions by reward"
								isLoading={isLoading}
								legend={
									<>
										<AnalyticsChartLegendItem label="Claims" colorClass="bg-chart-1" />
										<AnalyticsChartLegendItem label="Redemptions" colorClass="bg-chart-2" />
									</>
								}>
								<ChartContainer config={TOP_REWARDS_CHART_CONFIG} className={cn("aspect-auto w-full", ANALYTICS_CHART_HEIGHT_CLASS)}>
									<BarChart data={analytics?.topRewards ?? []} layout="vertical" margin={{ left: 4, right: 8 }}>
										<CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/60" />
										<XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
										<YAxis
											dataKey="title"
											type="category"
											width={TOP_REWARD_AXIS_WIDTH_PX}
											tickLine={false}
											axisLine={false}
											className="text-xs"
											tickFormatter={truncateAxisLabel}
										/>
										<ChartTooltip content={<ChartTooltipContent valueFormatter={formatPlatformCount} />} />
										<Bar dataKey="claims" fill="var(--color-claims)" name="Claims" radius={[0, 4, 4, 0]} />
										<Bar dataKey="redemptions" fill="var(--color-redemptions)" name="Redemptions" radius={[0, 4, 4, 0]} />
									</BarChart>
								</ChartContainer>
							</AnalyticsChartCard>
						</div>

						<AnalyticsFunnel
							title="Conversion Funnel"
							description="Track how rewards flow from creation to redemption"
							steps={funnelSteps}
							isLoading={isLoading || analytics === undefined}
						/>
					</section>
				</>
			)}
		</div>
	);
}
