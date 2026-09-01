"use client";

import { MerchantDashboardStatCard } from "@/components/dashboard/merchant-dashboard-stat-card";
import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { AnalyticsMetric, MerchantAnalyticsResponse, RewardResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Button, buttonVariants } from "@workspace/ui/components/form/button";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { ArrowRight, BarChart3, CheckCircle, Eye, Gift, Plus, ScanLine, Tag, TrendingUp, Users, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

const TOP_PERFORMER_TONES: readonly { readonly bg: string; readonly text: string; readonly bar: string }[] = [
	{ bg: "bg-success-soft", text: "text-success", bar: "bg-success" },
	{ bg: "bg-info-soft", text: "text-info", bar: "bg-info" },
	{ bg: "bg-chart-4/10", text: "text-chart-4", bar: "bg-chart-4" },
];

function getTopPerformerTone(index: number): { readonly bg: string; readonly text: string; readonly bar: string } {
	const fallback = TOP_PERFORMER_TONES[0];
	if (fallback === undefined) {
		return { bg: "bg-success-soft", text: "text-success", bar: "bg-success" };
	}
	return TOP_PERFORMER_TONES[index] ?? fallback;
}

interface QuickActionDefinition {
	readonly href: string;
	readonly title: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly iconClassName: string;
	readonly hoverClassName: string;
}

const QUICK_ACTIONS: readonly QuickActionDefinition[] = [
	{
		href: "/rewards/new",
		title: "Create Reward",
		description: "Launch a new campaign",
		icon: Plus,
		iconClassName: "bg-primary/10 text-primary group-hover:bg-primary/20",
		hoverClassName: "group-hover:text-primary",
	},
	{
		href: "/analytics",
		title: "View Analytics",
		description: "Track performance",
		icon: BarChart3,
		iconClassName: "bg-info-soft text-info group-hover:bg-info/20",
		hoverClassName: "group-hover:text-info",
	},
	{
		href: "/redemptions",
		title: "Redemptions",
		description: "POS activity log",
		icon: ScanLine,
		iconClassName: "bg-chart-4/10 text-chart-4 group-hover:bg-chart-4/20",
		hoverClassName: "group-hover:text-chart-4",
	},
	{
		href: "/api-keys",
		title: "Quick Setup",
		description: "Configure terminals",
		icon: Zap,
		iconClassName: "bg-warning-soft text-warning group-hover:bg-warning/20",
		hoverClassName: "group-hover:text-warning",
	},
];

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) {
		return "Good morning";
	}
	if (hour < 18) {
		return "Good afternoon";
	}
	return "Good evening";
}

function formatMetricValue(metric: AnalyticsMetric, suffix?: string): string {
	const formatted = metric.value.toLocaleString();
	return suffix === undefined ? formatted : `${formatted}${suffix}`;
}

function isRewardActive(reward: RewardResponse): boolean {
	return reward.status === "PUBLISHED";
}

export interface MerchantDashboardPageViewProps {
	readonly businessName: string;
	readonly initialAnalytics?: MerchantAnalyticsResponse;
	readonly initialRewards?: readonly RewardResponse[];
}

export function MerchantDashboardPageView({ businessName, initialAnalytics, initialRewards }: MerchantDashboardPageViewProps): React.JSX.Element {
	const { api, user } = useAuth();

	const initialAnalyticsData = React.useMemo(
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

	const initialRewardsData = React.useMemo(
		() =>
			initialRewards !== undefined
				? {
						success: true as const,
						data: [...initialRewards],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialRewards],
	);

	const analyticsQuery = api.merchant.analytics.useQuery({}, { initialData: initialAnalyticsData });
	const rewardsQuery = api.merchant.rewards.list.useQuery({}, { initialData: initialRewardsData });

	const analytics = analyticsQuery.data?.data;
	const rewards: readonly RewardResponse[] = rewardsQuery.data?.data ?? [];
	const analyticsLoading = analyticsQuery.isLoading && initialAnalytics === undefined;
	const rewardsLoading = rewardsQuery.isLoading && initialRewards === undefined;

	const displayBusinessName = businessName.length > 0 ? businessName : "Your Business";
	const greetingName = user?.fullName ?? displayBusinessName;

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-1">
					<p className="text-sm text-muted-foreground">{getGreeting()}</p>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">{greetingName}</h1>
					<p className="text-muted-foreground">Here is an overview of {displayBusinessName}&apos;s rewards performance.</p>
				</div>
				<div className="flex gap-3">
					<Link href="/analytics" className={cn(buttonVariants({ variant: "outline" }), "gap-2 bg-transparent")}>
						<BarChart3 className="size-4" aria-hidden="true" />
						Analytics
					</Link>
					<Link href="/rewards/new" className={cn(buttonVariants(), "gap-2")}>
						<Plus className="size-4" aria-hidden="true" />
						Create Reward
					</Link>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
				<MerchantDashboardStatCard
					label="Total Claims"
					icon={Gift}
					tone="success"
					value={analytics !== undefined ? formatMetricValue(analytics.totalClaims) : undefined}
					changePercent={analytics?.totalClaims.changePercent ?? null}
					isLoading={analyticsLoading}
				/>
				<MerchantDashboardStatCard
					label="Redemptions"
					icon={CheckCircle}
					tone="info"
					value={analytics !== undefined ? formatMetricValue(analytics.totalRedemptions) : undefined}
					changePercent={analytics?.totalRedemptions.changePercent ?? null}
					isLoading={analyticsLoading}
				/>
				<MerchantDashboardStatCard
					label="Conversion Rate"
					icon={TrendingUp}
					tone="accent"
					value={analytics !== undefined ? formatMetricValue(analytics.conversionRate, "%") : undefined}
					changePercent={analytics?.conversionRate.changePercent ?? null}
					isLoading={analyticsLoading}
				/>
				<MerchantDashboardStatCard
					label="Referrals"
					icon={Users}
					tone="warning"
					value={analytics !== undefined ? formatMetricValue(analytics.referralCount) : undefined}
					changePercent={analytics?.referralCount.changePercent ?? null}
					isLoading={analyticsLoading}
				/>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<Card className="border-border/80 bg-card shadow-xs lg:col-span-2">
					<CardHeader className="flex flex-row items-center justify-between pb-4">
						<div className="space-y-1">
							<CardTitle className="text-lg font-medium">Your Rewards</CardTitle>
							<CardDescription>Manage your active reward campaigns</CardDescription>
						</div>
						<Link href="/rewards" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-muted-foreground hover:text-foreground")}>
							View all
							<ArrowRight className="size-4" aria-hidden="true" />
						</Link>
					</CardHeader>
					<CardContent>
						{rewardsLoading ? (
							<div className="space-y-4">
								{[1, 2, 3].map((index) => (
									<div key={index} className="flex items-center gap-4 rounded-xl bg-muted/30 p-4">
										<Skeleton className="size-14 rounded-xl" />
										<div className="flex-1 space-y-2">
											<Skeleton className="h-4 w-40" />
											<Skeleton className="h-3 w-28" />
										</div>
										<Skeleton className="h-6 w-16" />
									</div>
								))}
							</div>
						) : rewards.length > 0 ? (
							<div className="space-y-3">
								{rewards.slice(0, 4).map((reward) => {
									const active = isRewardActive(reward);

									return (
										<Link
											key={reward.id}
											href={`/rewards/${reward.id}`}
											className="group flex items-center gap-4 rounded-xl bg-muted/30 p-4 transition-colors hover:bg-muted/50">
											<div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
												<Tag className="size-6 text-primary" aria-hidden="true" />
											</div>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<p className="truncate font-medium text-foreground transition-colors group-hover:text-primary">{reward.title}</p>
													<Badge variant={active ? "default" : "secondary"} className="shrink-0">
														{active ? "Active" : "Inactive"}
													</Badge>
												</div>
												<div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
													<div className="flex items-center gap-1">
														<Eye className="size-3.5" aria-hidden="true" />
														<span>{reward.claimCount.toLocaleString()} claims</span>
													</div>
													<div className="flex items-center gap-1">
														<CheckCircle className="size-3.5" aria-hidden="true" />
														<span>{reward.redemptionCount.toLocaleString()} redeemed</span>
													</div>
												</div>
											</div>
											<ArrowRight className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
										</Link>
									);
								})}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center">
								<div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
									<Tag className="size-8 text-muted-foreground" aria-hidden="true" />
								</div>
								<h3 className="mb-1 font-medium text-foreground">No rewards yet</h3>
								<p className="mb-4 max-w-sm text-sm text-muted-foreground">Create your first reward to start engaging with customers.</p>
								<Link href="/rewards/new">
									<Button size="sm">
										<Plus className="me-2 size-4" aria-hidden="true" />
										Create your first reward
									</Button>
								</Link>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="border-border/80 bg-card shadow-xs">
					<CardHeader className="pb-4">
						<CardTitle className="text-lg font-medium">Top Performing</CardTitle>
						<CardDescription>Rewards with highest conversion</CardDescription>
					</CardHeader>
					<CardContent>
						{analyticsLoading ? (
							<div className="space-y-5">
								{[1, 2, 3].map((index) => (
									<div key={index} className="space-y-2">
										<div className="flex items-center gap-3">
											<Skeleton className="size-8 rounded-full" />
											<div className="flex-1">
												<Skeleton className="mb-1 h-4 w-32" />
												<Skeleton className="h-3 w-20" />
											</div>
										</div>
										<Skeleton className="h-1.5 w-full rounded-full" />
									</div>
								))}
							</div>
						) : analytics !== undefined && analytics.topRewards.length > 0 ? (
							<div className="space-y-5">
								{analytics.topRewards.map((reward, index) => {
									const conversionRate = reward.claims > 0 ? Math.round((reward.redemptions / reward.claims) * 100) : 0;
									const tone = getTopPerformerTone(index);

									return (
										<div key={reward.rewardId} className="space-y-2">
											<div className="flex items-center gap-3">
												<div className={cn("flex size-8 items-center justify-center rounded-full", tone.bg)}>
													<span className={cn("text-sm font-semibold tabular-nums", tone.text)}>{index + 1}</span>
												</div>
												<div className="min-w-0 flex-1">
													<p className="truncate text-sm font-medium text-foreground">{reward.title}</p>
													<p className="text-xs text-muted-foreground">
														{reward.claims.toLocaleString()} claims · {reward.redemptions.toLocaleString()} redeemed
													</p>
												</div>
												<span className={cn("text-sm font-semibold tabular-nums", tone.text)}>{conversionRate}%</span>
											</div>
											<div className="h-1.5 overflow-hidden rounded-full bg-muted">
												<div className={cn("h-full rounded-full transition-all duration-500", tone.bar)} style={{ width: `${String(conversionRate)}%` }} />
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<TrendingUp className="mb-2 size-8 text-muted-foreground" aria-hidden="true" />
								<p className="text-sm text-muted-foreground">No data available yet</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{QUICK_ACTIONS.map((action) => {
					const Icon = action.icon;

					return (
						<Link key={action.href} href={action.href} className="group h-full">
							<Card className="h-full cursor-pointer transition-colors hover:border-primary/50">
								<CardContent className="flex h-full items-center gap-4 p-5">
									<div className={cn("flex size-12 items-center justify-center rounded-xl transition-colors", action.iconClassName)}>
										<Icon className="size-6" aria-hidden="true" />
									</div>
									<div>
										<p className={cn("font-medium text-foreground transition-colors", action.hoverClassName)}>{action.title}</p>
										<p className="text-sm text-muted-foreground">{action.description}</p>
									</div>
								</CardContent>
							</Card>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
