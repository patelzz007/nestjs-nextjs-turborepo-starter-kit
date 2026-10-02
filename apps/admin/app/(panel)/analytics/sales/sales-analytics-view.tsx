"use client";

import type { AdminSalesAnalyticsResponse } from "@workspace/shared";
import { AnalyticsPageHeader } from "@workspace/ui/components/display/analytics-page-header";
import { Alert } from "@workspace/ui/components/feedback/alert";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/feedback/empty";
import { Button } from "@workspace/ui/components/form/button";
import { Label } from "@workspace/ui/components/form/label";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/form/native-select";
import { cn } from "@workspace/ui/lib/core/utils";
import { Receipt } from "lucide-react";
import * as React from "react";

import { SalesOverTimeChart } from "@/components/analytics/sales-over-time-chart";
import { SalesStatCards } from "@/components/analytics/sales-stat-cards";
import { TopMerchantsTable } from "@/components/analytics/top-merchants-table";
import type { TopMerchantRow } from "@/lib/analytics/sales-analytics";
import { parseSalesPeriodWeeks, SALES_PERIOD_PRESETS, salesPeriodLabel, type SalesPeriodWeeks } from "@/lib/analytics/sales-period";

/** What the page has to show — one state at a time. */
export type SalesAnalyticsState =
	| { readonly status: "loading" }
	| { readonly status: "error"; readonly message: string }
	| {
			readonly status: "success";
			readonly data: AdminSalesAnalyticsResponse;
			readonly topMerchants: readonly TopMerchantRow[];
			/** False when the period has no paid bill (the chart and table give way to an empty state). */
			readonly hasSales: boolean;
	  };

export interface SalesAnalyticsViewProps {
	readonly state: SalesAnalyticsState;
	readonly weeks: SalesPeriodWeeks;
	readonly onWeeksChange: (weeks: SalesPeriodWeeks) => void;
	readonly onRetry: () => void;
	/** A new period or a refetch is on its way; the current numbers stay visible. */
	readonly isRefreshing: boolean;
}

const PERIOD_SELECT_ID = "sales-period";

function SalesAnalyticsContent({ state, weeks, onRetry }: Pick<SalesAnalyticsViewProps, "state" | "weeks" | "onRetry">): React.JSX.Element {
	const periodLabel = salesPeriodLabel(weeks).toLowerCase();

	switch (state.status) {
		case "loading":
			return (
				<>
					<SalesStatCards summary={undefined} />
					<SalesOverTimeChart sales={undefined} description={`Paid bill totals per week, ${periodLabel}`} />
					<TopMerchantsTable rows={undefined} description={`Highest sales, ${periodLabel}`} />
				</>
			);
		case "error":
			return (
				<Alert variant="destructive" title="Couldn't load sales analytics" description={state.message}>
					<Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
						Try again
					</Button>
				</Alert>
			);
		case "success":
			return (
				<>
					<SalesStatCards summary={state.data} />
					{state.hasSales ? (
						<>
							<SalesOverTimeChart sales={state.data.sales} description={`Paid bill totals per week, ${periodLabel}`} />
							<TopMerchantsTable rows={state.topMerchants} description={`Highest sales, ${periodLabel}`} />
						</>
					) : (
						<Empty className="border">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<Receipt aria-hidden="true" />
								</EmptyMedia>
								<EmptyTitle>No sales in this period</EmptyTitle>
								<EmptyDescription>
									Merchants&apos; POS systems report paid bills through the checkout API. Bills appear here once reported — try a longer period.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
				</>
			);
	}
}

/** Platform sales page body: header with the period picker, then cards, weekly chart and top merchants. */
export function SalesAnalyticsView({ state, weeks, onWeeksChange, onRetry, isRefreshing }: SalesAnalyticsViewProps): React.JSX.Element {
	const handlePeriodChange = React.useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>): void => {
			onWeeksChange(parseSalesPeriodWeeks(event.target.value));
		},
		[onWeeksChange],
	);

	return (
		<div className="space-y-6">
			<AnalyticsPageHeader
				title="Sales"
				description="Paid bills reported by merchants' POS systems across the platform."
				actions={
					<div className="flex items-center gap-2">
						<Label htmlFor={PERIOD_SELECT_ID} className="text-sm text-muted-foreground">
							Period
						</Label>
						<NativeSelect id={PERIOD_SELECT_ID} value={String(weeks)} onChange={handlePeriodChange}>
							{SALES_PERIOD_PRESETS.map((preset) => (
								<NativeSelectOption key={preset.weeks} value={String(preset.weeks)}>
									{preset.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</div>
				}
			/>

			<div aria-busy={isRefreshing} className={cn("space-y-6 transition-opacity", isRefreshing && "opacity-60")}>
				<SalesAnalyticsContent state={state} weeks={weeks} onRetry={onRetry} />
			</div>
		</div>
	);
}
