"use client";

import { DISPLAY_LOCALE } from "@/lib/format/dates";
import { formatCount } from "@/lib/format/numbers";
import type { AdminSalesAnalyticsResponse } from "@workspace/shared";
import { AnalyticsStatCard, type AnalyticsStatAccent } from "@workspace/ui/components/display/analytics-stat-card";
import { formatMinorUnits } from "@workspace/ui/lib/format/money";
import { cn } from "@workspace/ui/lib/core/utils";
import { Receipt, ShoppingBag, Store, Wallet, type LucideIcon } from "lucide-react";
import * as React from "react";

/** The headline numbers of `GET /admin/analytics/sales`. */
export type SalesStatSummary = Pick<AdminSalesAnalyticsResponse, "sales" | "activeMerchants">;

interface SalesStatCardDefinition {
	readonly key: "totalSales" | "bills" | "averageBill" | "activeMerchants";
	readonly label: string;
	readonly icon: LucideIcon;
	readonly accent: AnalyticsStatAccent;
}

const SALES_STAT_CARDS: readonly SalesStatCardDefinition[] = [
	{ key: "totalSales", label: "Total sales", icon: Wallet, accent: "primary" },
	{ key: "bills", label: "Bills", icon: Receipt, accent: "info" },
	{ key: "averageBill", label: "Average bill", icon: ShoppingBag, accent: "success" },
	{ key: "activeMerchants", label: "Active merchants", icon: Store, accent: "secondary" },
];

interface StatValue {
	readonly value: string;
	readonly changePercent: number | null;
}

function statValue(key: SalesStatCardDefinition["key"], summary: SalesStatSummary): StatValue {
	const { sales, activeMerchants } = summary;
	switch (key) {
		case "totalSales":
			return { value: formatMinorUnits(sales.totalSalesMinor.value, sales.currency, DISPLAY_LOCALE), changePercent: sales.totalSalesMinor.changePercent };
		case "bills":
			return { value: formatCount(sales.bills.value), changePercent: sales.bills.changePercent };
		case "averageBill":
			return { value: formatMinorUnits(sales.averageBillMinor.value, sales.currency, DISPLAY_LOCALE), changePercent: sales.averageBillMinor.changePercent };
		case "activeMerchants":
			return { value: formatCount(activeMerchants.value), changePercent: activeMerchants.changePercent };
	}
}

export interface SalesStatCardsProps {
	/** `undefined` renders skeleton cards. */
	readonly summary: SalesStatSummary | undefined;
	readonly className?: string;
}

/** Total sales, bills, average bill and active merchants, each with its change vs the previous period. */
export function SalesStatCards({ summary, className }: SalesStatCardsProps): React.JSX.Element {
	return (
		<div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
			{SALES_STAT_CARDS.map((card) => {
				const stat = summary === undefined ? undefined : statValue(card.key, summary);
				return (
					<AnalyticsStatCard
						key={card.key}
						label={card.label}
						icon={card.icon}
						accent={card.accent}
						{...(stat !== undefined ? { value: stat.value } : {})}
						changePercent={stat?.changePercent ?? null}
						isLoading={stat === undefined}
					/>
				);
			})}
		</div>
	);
}
