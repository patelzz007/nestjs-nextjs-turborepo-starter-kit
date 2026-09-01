"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { AnalyticsMetric, RewardClaimStatus, UserRewardsAnalyticsResponse } from "@workspace/shared";
import { AnalyticsChartCard, AnalyticsChartLegendItem } from "@workspace/ui/components/display/analytics-chart-card";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { AnalyticsStatCard, type AnalyticsStatAccent } from "@workspace/ui/components/display/analytics-stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { format } from "date-fns";
import { Gift, Share2, Ticket, TrendingUp, type LucideIcon } from "lucide-react";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const ACTIVITY_CHART_CONFIG: ChartConfig = {
	claims: { label: "Claims", color: "var(--chart-1)" },
	redemptions: { label: "Redeemed", color: "var(--chart-2)" },
};

interface StatCardDefinition {
	readonly key: keyof Pick<
		UserRewardsAnalyticsResponse,
		"totalClaims" | "pendingClaims" | "redeemedClaims" | "expiredClaims" | "referralsSent" | "referralsCredited" | "conversionRate"
	>;
	readonly label: string;
	readonly icon: LucideIcon;
	readonly accent: AnalyticsStatAccent;
	readonly suffix?: string;
}

const STAT_CARDS: readonly StatCardDefinition[] = [
	{ key: "totalClaims", label: "Total Claims", icon: Ticket, accent: "primary" },
	{ key: "pendingClaims", label: "Pending", icon: Gift, accent: "warning" },
	{ key: "redeemedClaims", label: "Redeemed", icon: TrendingUp, accent: "success" },
	{ key: "expiredClaims", label: "Expired", icon: Ticket, accent: "secondary" },
	{ key: "referralsSent", label: "Referrals Sent", icon: Share2, accent: "info" },
	{ key: "referralsCredited", label: "Referrals Credited", icon: Share2, accent: "success" },
	{ key: "conversionRate", label: "Redemption Rate", icon: TrendingUp, accent: "primary", suffix: "%" },
];

const STAT_SECTIONS: readonly { readonly title: string; readonly keys: readonly StatCardDefinition["key"][] }[] = [
	{
		title: "Claims",
		keys: ["totalClaims", "pendingClaims", "redeemedClaims", "expiredClaims"],
	},
	{
		title: "Referrals & conversion",
		keys: ["referralsSent", "referralsCredited", "conversionRate"],
	},
];

const STAT_CARD_BY_KEY = Object.fromEntries(STAT_CARDS.map((stat) => [stat.key, stat])) as Record<StatCardDefinition["key"], StatCardDefinition>;

const STATUS_BAR_COLORS: Record<RewardClaimStatus, string> = {
	PENDING: "bg-warning",
	REDEEMED: "bg-success",
	EXPIRED: "bg-muted-foreground/40",
};

const STATUS_LABELS: Record<RewardClaimStatus, string> = {
	PENDING: "Pending",
	REDEEMED: "Redeemed",
	EXPIRED: "Expired",
};

function formatMetricValue(metric: AnalyticsMetric, suffix?: string): string {
	const formatted = metric.value.toLocaleString();
	return suffix === undefined ? formatted : `${formatted}${suffix}`;
}

export interface RewardHubAnalyticsPageViewProps {
	readonly initialAnalytics?: UserRewardsAnalyticsResponse;
}

export function RewardHubAnalyticsPageView({ initialAnalytics }: RewardHubAnalyticsPageViewProps): React.JSX.Element {
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

	const analyticsQuery = api.claims.analytics.useQuery(
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

	return (
		<div className="space-y-8">
			<AnalyticsPageHeader title="My Activity" description="Track your claims, redemptions, and referral performance over time" />

			<div className="space-y-8">
				{STAT_SECTIONS.map((section) => (
					<section key={section.title} className="space-y-4">
						<h2 className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">{section.title}</h2>
						<div className={cn("grid gap-4", section.keys.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
							{section.keys.map((key) => {
								const stat = STAT_CARD_BY_KEY[key];
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
					</section>
				))}
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<AnalyticsChartCard
					title="Claims Over Time"
					description="Weekly claims and redemptions for your account"
					isLoading={isLoading}
					legend={
						<>
							<AnalyticsChartLegendItem label="Claims" colorClass="bg-chart-1" />
							<AnalyticsChartLegendItem label="Redeemed" colorClass="bg-chart-2" />
						</>
					}>
					<ChartContainer config={ACTIVITY_CHART_CONFIG} className="aspect-auto h-[300px] w-full">
						<AreaChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
							<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
							<YAxis tickLine={false} axisLine={false} width={36} className="text-xs" />
							<ChartTooltip content={<ChartTooltipContent />} />
							<Area dataKey="claims" type="monotone" fill="var(--color-claims)" fillOpacity={0.18} stroke="var(--color-claims)" strokeWidth={2} />
							<Area dataKey="redemptions" type="monotone" fill="var(--color-redemptions)" fillOpacity={0.18} stroke="var(--color-redemptions)" strokeWidth={2} />
						</AreaChart>
					</ChartContainer>
				</AnalyticsChartCard>

				<Card className="border-border/80 bg-card shadow-xs">
					<CardHeader>
						<CardTitle>By Status</CardTitle>
						<CardDescription>Current period claim breakdown</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						{isLoading || analytics === undefined ? (
							<Skeleton className="h-48 w-full rounded-lg" />
						) : (
							analytics.byStatus.map((row) => {
								const widthPercent = analytics.totalClaims.value === 0 ? 0 : Math.round((row.count / analytics.totalClaims.value) * 100);

								return (
									<div key={row.status} className="space-y-2">
										<div className="flex items-center justify-between text-sm">
											<span className="font-medium text-foreground">{STATUS_LABELS[row.status]}</span>
											<span className="text-muted-foreground tabular-nums">
												{row.count.toLocaleString()}
												<span className="ms-1.5 text-xs">({String(widthPercent)}%)</span>
											</span>
										</div>
										<div className="h-2 overflow-hidden rounded-full bg-muted">
											<div
												className={cn("h-full rounded-full transition-[width] duration-300", STATUS_BAR_COLORS[row.status])}
												style={{ width: `${String(widthPercent)}%` }}
											/>
										</div>
									</div>
								);
							})
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
