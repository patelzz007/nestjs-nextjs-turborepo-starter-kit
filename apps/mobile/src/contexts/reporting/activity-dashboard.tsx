// ============================================
// Activity dashboard — the Analytics screen's sections
// ============================================
// One CustomerAnalyticsDashboard and its ActivityInsights laid out for a
// phone, top to bottom: the headline (what was spent, with its trend), the
// four KPIs, highlights, this period against the last, claimed vs redeemed
// over time, when the customer shops, what they spent when and on what, the
// top shops, the claims by status, this month's budget, stamp cards,
// referrals and the latest visits. The web's "My Activity" sections keep the
// web's words; the extras are in insight-sections.tsx. Takes the data and
// renders it; where it comes from is the screen's business
// (src/app/(app)/analytics.tsx).

import type { CustomerAnalyticsDashboard } from "@workspace/shared";
import * as React from "react";
import { View } from "react-native";

import { Button } from "@workspace/ui-native/components/button";
import { Card } from "@workspace/ui-native/components/card";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import { KpiTile } from "../../components/kpi-tile";
import { RankedBarList } from "../../components/ranked-bar-list";
import { ShareBar } from "../../components/share-bar";
import { StatTiles } from "@workspace/ui-native/components/stat-tiles";
import { EmptyState } from "@workspace/ui-native/components/empty";
import { TrendChart, type TrendSeries } from "../../components/trend-chart";
import type { ActivityInsights } from "./activity-insights";
import type { ActivitySelection } from "./activity-range";
import {
	BudgetSection,
	HighlightsSection,
	PeriodComparisonSection,
	RecentVisitsSection,
	ShoppingDaysSection,
	SpendingMixSection,
	StampCardsSection,
} from "./insight-sections";
import {
	ACTIVITY_KPIS,
	activityFormatters,
	bucketColumnLabelOf,
	bucketLabelsOf,
	chartHintOf,
	claimStatusSegmentsOf,
	comparisonLabelOf,
	engagementSeriesOf,
	HEADLINE_KPI,
	isEmptyActivity,
	kpiViewOf,
	perBucketLabelOf,
	referralTilesOf,
	spendingSeriesOf,
	topShopItemsOf,
	type ActivityFormatters,
	type BucketLabels,
	type KpiDefinition,
	type KpiView,
} from "./presentation";

export interface ActivityDashboardProps {
	readonly dashboard: CustomerAnalyticsDashboard;
	/** The same range's extras. */
	readonly insights: ActivityInsights;
	/** How the range was chosen: a preset's periods are named by length, custom ones by their days. */
	readonly selection: ActivitySelection;
}

export function ActivityDashboard({ dashboard, insights, selection }: ActivityDashboardProps): React.JSX.Element {
	const formatters = React.useMemo((): ActivityFormatters => activityFormatters(dashboard.currency), [dashboard.currency]);
	const buckets = React.useMemo((): readonly BucketLabels[] => bucketLabelsOf(dashboard), [dashboard]);

	if (isEmptyActivity(dashboard.totals)) {
		return <EmptyState message="No activity in this range yet. Visits, rewards and referrals will show up here." />;
	}

	const comparisonLabel = comparisonLabelOf(dashboard.range);
	const headline = kpiViewOf(HEADLINE_KPI, dashboard, formatters);
	const perBucket = perBucketLabelOf(dashboard.range);
	const shops = topShopItemsOf(dashboard, formatters);

	return (
		<>
			<Card testID="analytics-spending">
				<KpiTile label={headline.label} value={headline.value} change={headline.change} comparisonLabel={comparisonLabel} size="hero" testID="analytics-headline" />
				<ChartWithValues
					title="Spending over time"
					series={spendingSeriesOf(dashboard)}
					buckets={buckets}
					formatValue={formatters.money}
					formatTick={formatters.moneyTick}
					hint={chartHintOf(dashboard.range)}
					bucketColumn={bucketColumnLabelOf(dashboard.range)}
					testID="analytics-spending-chart"
				/>
			</Card>
			<View className="flex-row flex-wrap gap-3" testID="analytics-kpis">
				{ACTIVITY_KPIS.map((definition: KpiDefinition): React.JSX.Element => (
					<KpiCard key={definition.key} view={kpiViewOf(definition, dashboard, formatters)} comparisonLabel={comparisonLabel} />
				))}
			</View>
			<HighlightsSection dashboard={dashboard} insights={insights} formatters={formatters} />
			<PeriodComparisonSection dashboard={dashboard} formatters={formatters} selection={selection} />
			<Card title="Claimed vs redeemed" description={`Rewards you claimed and redeemed, ${perBucket}`}>
				<ChartWithValues
					title="Claimed vs redeemed"
					series={engagementSeriesOf(dashboard)}
					buckets={buckets}
					formatValue={formatters.count}
					formatTick={formatters.count}
					hint={chartHintOf(dashboard.range)}
					bucketColumn={bucketColumnLabelOf(dashboard.range)}
					testID="analytics-engagement-chart"
				/>
			</Card>
			<ShoppingDaysSection insights={insights} formatters={formatters} />
			<SpendingMixSection dashboard={dashboard} insights={insights} formatters={formatters} />
			<Card title="Where you spent the most" description="Your top shops in this range">
				{shops.length === 0 ? <EmptyState message="No shop visits in this range." /> : <RankedBarList items={shops} testID="analytics-top-shops" />}
			</Card>
			<Card title="Your claims by status" description="Rewards you claimed in this range, by where they stand now">
				<ShareBar title="Your claims by status" segments={claimStatusSegmentsOf(dashboard, formatters)} testID="analytics-claims-by-status" />
			</Card>
			<BudgetSection insights={insights} formatters={formatters} />
			<StampCardsSection dashboard={dashboard} insights={insights} formatters={formatters} />
			<Card title="Referrals" description="Friends you invited, and what their visits earned you">
				<StatTiles items={referralTilesOf(dashboard.totals, formatters)} testID="analytics-referrals" />
			</Card>
			<RecentVisitsSection dashboard={dashboard} insights={insights} formatters={formatters} />
		</>
	);
}

interface KpiCardProps {
	readonly view: KpiView;
	readonly comparisonLabel: string;
}

/** A KPI on its own card, two to a row (one on a narrow phone). */
function KpiCard({ view, comparisonLabel }: KpiCardProps): React.JSX.Element {
	return (
		<View className="min-w-40 grow basis-40 rounded-xl border border-border bg-card p-4">
			<KpiTile
				label={view.label}
				value={view.value}
				change={view.change}
				comparisonLabel={comparisonLabel}
				trend={{ values: view.trend, color: "chart-1" }}
				testID={`analytics-kpi-${view.key}`}
			/>
		</View>
	);
}

interface ChartWithValuesProps {
	readonly title: string;
	readonly series: readonly TrendSeries[];
	readonly buckets: readonly BucketLabels[];
	readonly formatValue: (value: number) => string;
	readonly formatTick: (value: number) => string;
	readonly hint: string;
	/** The table's first column ("Day", "Week"). */
	readonly bucketColumn: string;
	readonly testID: string;
}

/**
 * A trend chart, and every value behind it as a table on request — the exact
 * numbers without scrubbing, for anyone who prefers reading to touching.
 */
function ChartWithValues({ title, series, buckets, formatValue, formatTick, hint, bucketColumn, testID }: ChartWithValuesProps): React.JSX.Element {
	const [showValues, setShowValues] = React.useState(false);
	const toggle = React.useCallback((): void => {
		setShowValues((current: boolean): boolean => !current);
	}, []);
	const bucketLabels = buckets.map((bucket: BucketLabels): string => bucket.full);
	const tickLabels = buckets.map((bucket: BucketLabels): string => bucket.tick);
	const table = valuesTableOf(series, bucketLabels, bucketColumn, formatValue);
	return (
		<View className="gap-2">
			<TrendChart
				title={title}
				series={series}
				bucketLabels={bucketLabels}
				tickLabels={tickLabels}
				formatValue={formatValue}
				formatTick={formatTick}
				hint={hint}
				testID={testID}
			/>
			<View className="self-start">
				<Button
					label={showValues ? "Hide values" : "Show values"}
					variant="ghost"
					onPress={toggle}
					accessibilityHint={`Lists every value of ${title}`}
					testID={`${testID}-values-toggle`}
				/>
			</View>
			{showValues ? <Table caption={`${title}, every value`} columns={table.columns} rows={table.rows} footer={table.footer} testID={`${testID}-values`} /> : null}
		</View>
	);
}

/** The column naming each row. */
const BUCKET_COLUMN_KEY = "bucket";

interface ValuesTable {
	readonly columns: readonly TableColumn<string>[];
	readonly rows: readonly TableRow<string>[];
	readonly footer: TableRow<string>;
}

/** A row per bucket and a column per series, closed by each series' total (every chart here adds up). */
function valuesTableOf(series: readonly TrendSeries[], bucketLabels: readonly string[], bucketColumn: string, formatValue: (value: number) => string): ValuesTable {
	const columns: readonly TableColumn<string>[] = [
		{ key: BUCKET_COLUMN_KEY, label: bucketColumn },
		...series.map((item: TrendSeries): TableColumn<string> => ({ key: item.key, label: item.label, align: "end" })),
	];
	const rowOf = (key: string, label: string, valueOf: (item: TrendSeries) => number): TableRow<string> => ({
		key,
		cells: Object.fromEntries([[BUCKET_COLUMN_KEY, label], ...series.map((item: TrendSeries): [string, string] => [item.key, formatValue(valueOf(item))])]),
	});
	return {
		columns,
		rows: bucketLabels.map((label: string, index: number): TableRow<string> => rowOf(String(index), label, (item: TrendSeries): number => item.values.at(index) ?? 0)),
		footer: rowOf("total", "Total", (item: TrendSeries): number => item.values.reduce((sum: number, value: number): number => sum + value, 0)),
	};
}
