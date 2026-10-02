"use client";

import { MerchantEmptyState } from "@/components/merchant-ui/empty-state";
import type { SalesSummary } from "@workspace/shared";
import { AnalyticsChartCard } from "@workspace/ui/components/display/analytics-chart-card";
import { AnalyticsStatCard, type AnalyticsStatAccent } from "@workspace/ui/components/display/analytics-stat-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { formatMinorUnits, formatMinorUnitsCompact } from "@workspace/ui/lib/format/money";
import { format } from "date-fns";
import { Receipt, ShoppingBag, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const SALES_CHART_CONFIG: ChartConfig = {
	salesMinor: { label: "Sales", color: "var(--chart-1)" },
};

const WEEKLY_SALES_TITLE = "Weekly sales";
const WEEKLY_SALES_DESCRIPTION = "Paid bill totals per week";

/** Room for compact money ticks ("RM 12.3K") on the y-axis. */
const SALES_Y_AXIS_WIDTH_PX = 64;

export interface MerchantSalesSectionProps {
	/** `undefined` until the analytics response arrives. */
	readonly sales: SalesSummary | undefined;
	readonly isLoading: boolean;
	/** The API keys page when this member may create keys; without it the empty state points to the store owner. */
	readonly apiKeysHref: string | undefined;
}

/** True when neither this period nor the previous one had a paid bill — the POS has not reported any yet. */
export function hasNoSalesHistory(sales: SalesSummary): boolean {
	return sales.bills.value === 0 && sales.bills.changePercent === null;
}

interface SalesCardDefinition {
	readonly label: string;
	readonly icon: LucideIcon;
	readonly accent: AnalyticsStatAccent;
}

const TOTAL_SALES_CARD: SalesCardDefinition = { label: "Total sales", icon: Wallet, accent: "primary" };
const BILLS_CARD: SalesCardDefinition = { label: "Bills", icon: Receipt, accent: "info" };
const AVERAGE_BILL_CARD: SalesCardDefinition = { label: "Average bill", icon: ShoppingBag, accent: "success" };
const SALES_CARDS: readonly SalesCardDefinition[] = [TOTAL_SALES_CARD, BILLS_CARD, AVERAGE_BILL_CARD];

function SalesSkeleton(): React.JSX.Element {
	return (
		<>
			<div className="grid gap-4 sm:grid-cols-3">
				{SALES_CARDS.map((card) => (
					<AnalyticsStatCard key={card.label} label={card.label} icon={card.icon} accent={card.accent} isLoading />
				))}
			</div>
			<AnalyticsChartCard title={WEEKLY_SALES_TITLE} description={WEEKLY_SALES_DESCRIPTION} isLoading>
				{null}
			</AnalyticsChartCard>
		</>
	);
}

function SalesOverview({ sales }: { readonly sales: SalesSummary }): React.JSX.Element {
	const { currency } = sales;

	const chartData = React.useMemo(
		() =>
			sales.overTime.map((point) => ({
				...point,
				label: format(new Date(point.date), "MMM d"),
			})),
		[sales.overTime],
	);

	const formatMoney = React.useCallback((minor: number): string => formatMinorUnits(minor, currency), [currency]);
	const formatMoneyTick = React.useCallback((minor: number): string => formatMinorUnitsCompact(minor, currency), [currency]);

	return (
		<>
			<div className="grid gap-4 sm:grid-cols-3">
				<AnalyticsStatCard
					label={TOTAL_SALES_CARD.label}
					icon={TOTAL_SALES_CARD.icon}
					accent={TOTAL_SALES_CARD.accent}
					value={formatMoney(sales.totalSalesMinor.value)}
					changePercent={sales.totalSalesMinor.changePercent}
				/>
				<AnalyticsStatCard
					label={BILLS_CARD.label}
					icon={BILLS_CARD.icon}
					accent={BILLS_CARD.accent}
					value={sales.bills.value.toLocaleString()}
					changePercent={sales.bills.changePercent}
				/>
				<AnalyticsStatCard
					label={AVERAGE_BILL_CARD.label}
					icon={AVERAGE_BILL_CARD.icon}
					accent={AVERAGE_BILL_CARD.accent}
					value={formatMoney(sales.averageBillMinor.value)}
					changePercent={sales.averageBillMinor.changePercent}
				/>
			</div>

			<AnalyticsChartCard title={WEEKLY_SALES_TITLE} description={WEEKLY_SALES_DESCRIPTION}>
				<ChartContainer config={SALES_CHART_CONFIG} className="aspect-auto h-[300px] w-full">
					<BarChart data={chartData}>
						<CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/60" />
						<XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
						<YAxis tickLine={false} axisLine={false} width={SALES_Y_AXIS_WIDTH_PX} className="text-xs" tickFormatter={formatMoneyTick} />
						<ChartTooltip content={<ChartTooltipContent valueFormatter={formatMoney} />} />
						<Bar dataKey="salesMinor" fill="var(--color-salesMinor)" name="salesMinor" radius={[4, 4, 0, 0]} />
					</BarChart>
				</ChartContainer>
			</AnalyticsChartCard>
		</>
	);
}

/** Paid POS bills: total, count and average bill, plus weekly sales. Money arrives in minor units. */
export function MerchantSalesSection({ sales, isLoading, apiKeysHref }: MerchantSalesSectionProps): React.JSX.Element {
	return (
		<section aria-labelledby="merchant-sales-heading" className="space-y-4">
			<div className="space-y-1">
				<h2 id="merchant-sales-heading" className="text-lg font-semibold tracking-tight text-foreground">
					Sales
				</h2>
				<p className="text-sm text-muted-foreground">Paid bills reported by your POS through the checkout API.</p>
			</div>

			{isLoading || sales === undefined ? (
				<SalesSkeleton />
			) : hasNoSalesHistory(sales) ? (
				<MerchantEmptyState
					title="No sales yet"
					description={
						apiKeysHref === undefined
							? "Sales appear once your POS reports bills through the checkout API. Ask your store owner to connect your POS."
							: "Sales appear once your POS reports bills through the checkout API."
					}
					icon={<Receipt className="size-5" aria-hidden="true" />}
					{...(apiKeysHref !== undefined
						? {
								action: (
									<Link href={apiKeysHref} className={buttonVariants({ variant: "outline" })}>
										Set up API keys
									</Link>
								),
							}
						: {})}
				/>
			) : (
				<SalesOverview sales={sales} />
			)}
		</section>
	);
}
