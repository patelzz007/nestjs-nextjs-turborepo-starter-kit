"use client";

import { WebEmptyState } from "@/components/web-ui/empty-state";
import type { CategorySpendSlice, MerchantSpendRow, SpendChartTone, SpendingSectionState } from "@/lib/rewards/spending-insights";
import { ROUTES } from "@/lib/routes";
import { AnalyticsStatCard } from "@workspace/ui/components/display/analytics-stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@workspace/ui/components/display/chart";
import { EntityAvatar } from "@workspace/ui/components/display/entity-avatar";
import { buttonVariants } from "@workspace/ui/components/form/button";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { Receipt, Store, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Pie, PieChart } from "recharts";

/** Tailwind swatch class and SVG fill per palette tone — literal strings so Tailwind emits them. */
const TONE_STYLES: Readonly<Record<SpendChartTone, { readonly swatch: string; readonly fill: string }>> = {
	"chart-1": { swatch: "bg-chart-1", fill: "var(--chart-1)" },
	"chart-2": { swatch: "bg-chart-2", fill: "var(--chart-2)" },
	"chart-3": { swatch: "bg-chart-3", fill: "var(--chart-3)" },
	"chart-4": { swatch: "bg-chart-4", fill: "var(--chart-4)" },
	"chart-5": { swatch: "bg-chart-5", fill: "var(--chart-5)" },
};

/** The donut has no series config of its own — each datum carries its fill. */
const CATEGORY_CHART_CONFIG: ChartConfig = {};

/** Donut geometry (px): a ring thin enough to read as a share, with room for the total in its hole. */
const DONUT_INNER_RADIUS = 62;
const DONUT_OUTER_RADIUS = 88;
/** A 2px surface-coloured stroke separates adjacent slices. */
const DONUT_SLICE_GAP = 2;

const MERCHANT_SKELETON_ROWS = 3;

const SECTION_HEADING_CLASS = "text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase";
const PANEL_CLASS = "border-border/80 bg-card shadow-xs";

interface SpendingStatsProps {
	readonly state: SpendingSectionState;
}

function SpendingStats({ state }: SpendingStatsProps): React.JSX.Element {
	const totals = state.status === "loading" ? undefined : state.totals;

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<AnalyticsStatCard
				label="Total spent"
				icon={Wallet}
				accent="primary"
				{...(totals !== undefined ? { value: totals.totalSpentLabel } : {})}
				changePercent={totals?.totalSpentChangePercent ?? null}
				isLoading={totals === undefined}
			/>
			<AnalyticsStatCard
				label="Shop visits"
				icon={Store}
				accent="info"
				{...(totals !== undefined ? { value: totals.visitsLabel } : {})}
				changePercent={totals?.visitsChangePercent ?? null}
				isLoading={totals === undefined}
			/>
		</div>
	);
}

export interface MerchantSpendListProps {
	readonly rows: readonly MerchantSpendRow[];
}

/** Ranked merchants: monogram, name, category, amount, visits and a share-of-spend bar (text carries every value). */
export function MerchantSpendList({ rows }: MerchantSpendListProps): React.JSX.Element {
	return (
		<ol aria-label="Shops ranked by your spending" className="space-y-4">
			{rows.map((row, index) => (
				<li key={row.organizationId} className="flex items-center gap-3">
					<span className="w-4 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums" aria-hidden="true">
						{index + 1}
					</span>
					<EntityAvatar name={row.merchantName} alt="" size="md" />
					<div className="min-w-0 flex-1 space-y-1.5">
						<div className="flex items-baseline justify-between gap-3">
							<p className="truncate text-sm font-medium text-foreground">{row.merchantName}</p>
							<p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{row.amountLabel}</p>
						</div>
						<div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
							<p className="truncate">
								{row.categoryLabel} · {row.visitsLabel}
							</p>
							<p className="shrink-0 tabular-nums">{row.shareLabel} of spend</p>
						</div>
						{/* Decorative: the share is stated in the text above. */}
						<div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
								style={{ width: `${String(row.sharePercent)}%` }}
							/>
						</div>
					</div>
				</li>
			))}
		</ol>
	);
}

interface CategoryChartDatum {
	readonly label: string;
	readonly totalMinor: number;
	readonly fill: string;
}

/** Tooltip row for a slice: its label and formatted amount — the charted value itself is in minor units. */
function renderCategoryTooltipRow(name: number | string | undefined, amountByLabel: ReadonlyMap<string, string>): React.ReactNode {
	const label = name === undefined ? "" : String(name);
	const amount = amountByLabel.get(label) ?? "";

	return (
		<div className="flex w-full items-center justify-between gap-4">
			<span className="text-muted-foreground">{label}</span>
			<span className="font-medium text-foreground tabular-nums">{amount}</span>
		</div>
	);
}

type CategoryTooltipFormatter = NonNullable<React.ComponentProps<typeof ChartTooltipContent>["formatter"]>;

export interface CategorySpendBreakdownProps {
	readonly slices: readonly CategorySpendSlice[];
	/** Shown in the donut's hole. */
	readonly totalLabel: string;
}

/**
 * Category share: a donut for the gestalt plus a list stating every slice's
 * label, amount and share — the list is the accessible equivalent, so the
 * chart is hidden from assistive technology and colour is never the only cue.
 */
export function CategorySpendBreakdown({ slices, totalLabel }: CategorySpendBreakdownProps): React.JSX.Element {
	const chartData = React.useMemo(
		(): CategoryChartDatum[] => slices.map((slice) => ({ label: slice.label, totalMinor: slice.totalMinor, fill: TONE_STYLES[slice.tone].fill })),
		[slices],
	);
	const amountByLabel = React.useMemo((): ReadonlyMap<string, string> => new Map(slices.map((slice) => [slice.label, slice.amountLabel])), [slices]);
	const formatTooltipRow: CategoryTooltipFormatter = React.useCallback((_value, name) => renderCategoryTooltipRow(name, amountByLabel), [amountByLabel]);

	return (
		<div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
			<div aria-hidden="true" className="relative size-48 shrink-0">
				<ChartContainer config={CATEGORY_CHART_CONFIG} className="aspect-square size-full">
					<PieChart>
						<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel formatter={formatTooltipRow} />} />
						<Pie
							data={chartData}
							dataKey="totalMinor"
							nameKey="label"
							innerRadius={DONUT_INNER_RADIUS}
							outerRadius={DONUT_OUTER_RADIUS}
							stroke="var(--card)"
							strokeWidth={DONUT_SLICE_GAP}
							isAnimationActive={false}
						/>
					</PieChart>
				</ChartContainer>
				<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
					<span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Total</span>
					<span className="text-sm font-bold text-foreground tabular-nums">{totalLabel}</span>
				</div>
			</div>

			<ul aria-label="Spending by category" className="w-full min-w-0 flex-1 space-y-3">
				{slices.map((slice) => (
					<li key={slice.key} className="flex items-start gap-3">
						<span aria-hidden="true" className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", TONE_STYLES[slice.tone].swatch)} />
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline justify-between gap-3">
								<p className="truncate text-sm font-medium text-foreground">{slice.label}</p>
								<p className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{slice.amountLabel}</p>
							</div>
							<div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
								<p className="truncate">{slice.detail ?? slice.visitsLabel}</p>
								<p className="shrink-0 tabular-nums">{slice.shareLabel}</p>
							</div>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

function BreakdownSkeleton(): React.JSX.Element {
	return (
		<div className="space-y-4" aria-hidden="true">
			{Array.from({ length: MERCHANT_SKELETON_ROWS }, (_, index) => (
				<div key={index} className="flex items-center gap-3">
					<Skeleton className="size-10 rounded-lg" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-1.5 w-full rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}

export interface SpendingSectionProps {
	readonly state: SpendingSectionState;
}

/** "Your spending": totals, where the user spent the most, and what they spent on. Purely presentational. */
export function SpendingSection({ state }: SpendingSectionProps): React.JSX.Element {
	const headingId = React.useId();

	return (
		<section aria-labelledby={headingId} aria-busy={state.status === "loading"} className="space-y-4">
			<h2 id={headingId} className={SECTION_HEADING_CLASS}>
				Your spending
			</h2>

			<SpendingStats state={state} />

			{state.status === "empty" ? (
				<WebEmptyState
					title="No spending yet"
					description="Spending shows up after you redeem a reward at a participating shop."
					icon={<Receipt className="size-5" aria-hidden="true" />}
					action={
						<Link href={ROUTES.rewardHub.browse} className={cn(buttonVariants({ variant: "outline" }))}>
							Browse rewards
						</Link>
					}
				/>
			) : (
				<div className="grid gap-6 lg:grid-cols-2">
					<Card className={PANEL_CLASS}>
						<CardHeader>
							<CardTitle>Where you spent the most</CardTitle>
							<CardDescription>Your top shops this period, by amount spent</CardDescription>
						</CardHeader>
						<CardContent>{state.status === "ready" ? <MerchantSpendList rows={state.merchants} /> : <BreakdownSkeleton />}</CardContent>
					</Card>

					<Card className={PANEL_CLASS}>
						<CardHeader>
							<CardTitle>What you spent on</CardTitle>
							<CardDescription>Your spending by type of shop</CardDescription>
						</CardHeader>
						<CardContent>
							{state.status === "ready" ? (
								<CategorySpendBreakdown slices={state.categories} totalLabel={state.totals.totalSpentLabel} />
							) : (
								<Skeleton className="h-48 w-full rounded-lg" />
							)}
						</CardContent>
					</Card>
				</div>
			)}
		</section>
	);
}
