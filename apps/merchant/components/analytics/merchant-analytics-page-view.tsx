"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { AnalyticsMetric, MerchantAnalyticsResponse } from "@workspace/shared";
import { AnalyticsChartCard, AnalyticsChartLegendItem } from "@workspace/ui/components/display/analytics-chart-card";
import { AnalyticsFunnel } from "@workspace/ui/components/display/analytics-funnel";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { AnalyticsStatCard, type AnalyticsStatAccent } from "@workspace/ui/components/display/analytics-stat-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { format } from "date-fns";
import { BarChart3, Tag, TrendingUp, Users, type LucideIcon } from "lucide-react";
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

function formatMetricValue(metric: AnalyticsMetric, suffix?: string): string {
	const formatted = metric.value.toLocaleString();
	return suffix === undefined ? formatted : `${formatted}${suffix}`;
}

export interface MerchantAnalyticsPageViewProps {
	readonly initialAnalytics?: MerchantAnalyticsResponse;
}

export function MerchantAnalyticsPageView({ initialAnalytics }: MerchantAnalyticsPageViewProps): React.JSX.Element {
	const { api } = useAuth();

	const initialQueryData = React.useMemo(
		() =>
			initialAnalytics !== undefined
				? {
						success: true as const,
						data: initialAnalytics,
						meta: stubApiMeta(),
					}
				: undefined,
		[initialAnalytics],
	);

	const analyticsQuery = api.merchant.analytics.useQuery(
		{},
		{
			initialData: initialQueryData,
		},
	);

	const analytics = analyticsQuery.data?.data;
	const isLoading = analyticsQuery.isLoading && initialAnalytics === undefined;

	const chartData = React.useMemo(
		() =>
			(analytics?.claimsOverTime ?? []).map((point) => ({
				...point,
				label: format(new Date(point.date), "MMM d"),
			})),
		[analytics?.claimsOverTime],
	);

	const funnelSteps = React.useMemo(
		() =>
			analytics === undefined
				? []
				: [
						{ label: "Rewards Created", value: analytics.totalRewards.value.toLocaleString(), accent: "primary" as const },
						{ label: "Total Claims", value: analytics.totalClaims.value.toLocaleString(), accent: "info" as const },
						{ label: "Redemptions", value: analytics.totalRedemptions.value.toLocaleString(), accent: "success" as const },
						{ label: "Conversion", value: `${String(analytics.conversionRate.value)}%`, accent: "warning" as const },
					],
		[analytics],
	);

	return (
		<div className="space-y-8">
			<AnalyticsPageHeader title="Analytics" description="Track your reward performance and customer engagement" />

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
				{STAT_CARDS.map((stat) => {
					const metric = analytics?.[stat.key];

					return (
						<AnalyticsStatCard
							key={stat.key}
							label={stat.label}
							icon={stat.icon}
							accent={stat.accent}
							value={metric !== undefined ? formatMetricValue(metric, stat.suffix) : undefined}
							changePercent={metric?.changePercent ?? null}
							isLoading={isLoading || metric === undefined}
						/>
					);
				})}
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<AnalyticsChartCard
					title="Claims & Redemptions"
					description="Weekly performance over the last 8 weeks"
					isLoading={isLoading}
					legend={
						<>
							<AnalyticsChartLegendItem label="Claims" colorClass="bg-chart-1" />
							<AnalyticsChartLegendItem label="Redemptions" colorClass="bg-chart-2" />
						</>
					}>
					<ChartContainer config={CLAIMS_CHART_CONFIG} className="aspect-auto h-[300px] w-full">
						<AreaChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
							<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
							<YAxis tickLine={false} axisLine={false} width={36} className="text-xs" />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Area dataKey="claims" type="monotone" fill="var(--color-claims)" fillOpacity={0.18} stroke="var(--color-claims)" strokeWidth={2} stackId="1" />
							<Area dataKey="redemptions" type="monotone" fill="var(--color-redemptions)" fillOpacity={0.18} stroke="var(--color-redemptions)" strokeWidth={2} stackId="2" />
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
					<ChartContainer config={TOP_REWARDS_CHART_CONFIG} className="aspect-auto h-[300px] w-full">
						<BarChart data={analytics?.topRewards ?? []} layout="vertical" margin={{ left: 4, right: 8 }}>
							<CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border/60" />
							<XAxis type="number" tickLine={false} axisLine={false} className="text-xs" />
							<YAxis
								dataKey="title"
								type="category"
								width={108}
								tickLine={false}
								axisLine={false}
								className="text-xs"
								tickFormatter={(value: string): string => (value.length > 15 ? `${value.slice(0, 15)}…` : value)}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
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
		</div>
	);
}
