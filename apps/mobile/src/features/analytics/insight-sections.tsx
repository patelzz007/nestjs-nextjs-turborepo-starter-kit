// ============================================
// Insight sections — the Analytics screen's extra cards
// ============================================
// The sections beyond the web's "My Activity" page: highlights, this period
// against the last, when the customer shops and spends, spending by
// category, this month's budget, stamp cards and recent visits. Each takes
// the data it shows and lays it out with the generic chart components
// (src/components); the labels come from insight-presentation.ts.

import type { CustomerAnalyticsDashboard } from "@workspace/shared";
import * as React from "react";
import { View } from "react-native";

import { Card } from "../../components/card";
import { ColumnChart } from "../../components/column-chart";
import { ComparisonBars } from "../../components/comparison-bars";
import { DetailList } from "../../components/detail-list";
import { DonutChart } from "../../components/donut-chart";
import { HeatmapGrid } from "../../components/heatmap-grid";
import { HighlightGrid } from "../../components/highlight-grid";
import { ProgressList } from "../../components/progress-list";
import { ProgressRing } from "../../components/progress-ring";
import { RankedBarList } from "../../components/ranked-bar-list";
import { EmptyState } from "../../components/states";
import { Subheading } from "../../components/text";
import { Timeline } from "../../components/timeline";
import type { ActivityInsights } from "./activity-insights";
import type { ActivitySelection } from "./activity-range";
import {
	asOfLabelOf,
	budgetViewOf,
	categoryItemsOf,
	comparisonItemsOf,
	dayPartSegmentsOf,
	highlightsOf,
	periodNamesOf,
	stampItemsOf,
	timelineItemsOf,
	visitHeatmapOf,
	visitsLabelOf,
	weekdayColumnsOf,
} from "./insight-presentation";
import type { ActivityFormatters } from "./presentation";

interface DashboardSectionProps {
	readonly dashboard: CustomerAnalyticsDashboard;
	readonly formatters: ActivityFormatters;
}

interface InsightSectionProps {
	readonly insights: ActivityInsights;
	readonly formatters: ActivityFormatters;
}

export function HighlightsSection({ dashboard, insights, formatters }: DashboardSectionProps & InsightSectionProps): React.JSX.Element {
	return (
		<View className="gap-3">
			<Subheading>Highlights</Subheading>
			<HighlightGrid items={highlightsOf(dashboard, insights, formatters)} testID="analytics-highlights" />
		</View>
	);
}

interface PeriodComparisonSectionProps extends DashboardSectionProps {
	readonly selection: ActivitySelection;
}

export function PeriodComparisonSection({ dashboard, formatters, selection }: PeriodComparisonSectionProps): React.JSX.Element {
	const names = periodNamesOf(dashboard.range, selection);
	return (
		<Card title="This period vs the last" description="Each measure next to the equally long period right before">
			<ComparisonBars items={comparisonItemsOf(dashboard, formatters)} currentName={names.current} previousName={names.previous} testID="analytics-comparison" />
		</Card>
	);
}

export function ShoppingDaysSection({ insights, formatters }: InsightSectionProps): React.JSX.Element {
	const heatmap = visitHeatmapOf(insights);
	const formatVisits = React.useCallback((value: number): string => visitsLabelOf(value, formatters), [formatters]);
	return (
		<>
			<Card title="Your busiest days" description="Shop visits by day of the week">
				<ColumnChart title="Visits by day of the week" columns={weekdayColumnsOf(insights, formatters)} hint="Tap a day to see its visits" testID="analytics-weekdays" />
			</Card>
			<Card title="When you visit" description="Shop visits by day and time of day">
				<HeatmapGrid
					title="Visits by day and time of day"
					rows={heatmap.rows}
					columns={heatmap.columns}
					values={heatmap.values}
					formatValue={formatVisits}
					hint="Tap a square to see its visits"
					testID="analytics-visit-times"
				/>
			</Card>
		</>
	);
}

export function SpendingMixSection({ dashboard, insights, formatters }: DashboardSectionProps & InsightSectionProps): React.JSX.Element {
	const categories = categoryItemsOf(dashboard, formatters);
	return (
		<>
			<Card title="When you spend" description="What you spent, by time of day">
				<DonutChart
					title="Spending by time of day"
					segments={dayPartSegmentsOf(insights, formatters)}
					centerValue={formatters.money(dashboard.totals.spentMinor.value)}
					centerLabel="spent"
					testID="analytics-day-parts"
				/>
			</Card>
			<Card title="Spending by category" description="What kind of shops your money went to">
				{categories.length === 0 ? <EmptyState message="No spending in this range." /> : <RankedBarList items={categories} testID="analytics-categories" />}
			</Card>
		</>
	);
}

export function BudgetSection({ insights, formatters }: InsightSectionProps): React.JSX.Element {
	const budget = budgetViewOf(insights.monthBudget, formatters);
	return (
		<Card title="Monthly budget" description={`What you spent ${budget.periodLabel}, against your monthly budget`}>
			<View className="flex-row flex-wrap items-center gap-5">
				<ProgressRing
					label="Monthly budget used"
					value={budget.value}
					max={budget.max}
					valueLabel={budget.valueLabel}
					caption={budget.caption}
					accessibilityValueText={budget.accessibilityValueText}
					testID="analytics-budget"
				/>
				<View className="min-w-36 flex-1">
					<DetailList items={budget.details} />
				</View>
			</View>
		</Card>
	);
}

export function StampCardsSection({ dashboard, insights, formatters }: DashboardSectionProps & InsightSectionProps): React.JSX.Element {
	const items = stampItemsOf(insights.stampCards, formatters);
	return (
		<Card title="Stamp cards" description={`Visits towards your next free reward at each shop, ${asOfLabelOf(dashboard.range)}`}>
			{items.length === 0 ? <EmptyState message="No stamps collected yet." /> : <ProgressList items={items} display="steps" color="chart-2" testID="analytics-stamp-cards" />}
		</Card>
	);
}

export function RecentVisitsSection({ dashboard, insights, formatters }: DashboardSectionProps & InsightSectionProps): React.JSX.Element {
	return (
		<Card title="Recent visits" description="Your latest visits in this range">
			{insights.recentVisits.length === 0 ? (
				<EmptyState message="No visits in this range." />
			) : (
				<Timeline items={timelineItemsOf(insights.recentVisits, formatters, dashboard.range.timeZone)} testID="analytics-recent-visits" />
			)}
		</Card>
	);
}
