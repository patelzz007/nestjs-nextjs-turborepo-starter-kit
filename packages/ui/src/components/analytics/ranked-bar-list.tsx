"use client";

import { ChartStateFrame, CHART_READY, type ChartFrameState } from "@workspace/ui/components/analytics/analytics-panel";
import { CHART_SLOT_BACKGROUNDS, type ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { rankOpacity } from "@workspace/ui/lib/charts/chart-encodings";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** One ranked row: its name, the value its bar is scaled by, and that value formatted. */
export interface RankedBarItem {
	/** Stable identity (an id, a category code). */
	readonly key: string;
	readonly label: string;
	/** Drives the bar length; ≥ 0. */
	readonly value: number;
	readonly valueLabel: string;
	/** A quieter second line, e.g. "42 bills · 12.5% of sales". */
	readonly detail?: string | undefined;
}

export interface RankedBarListProps extends Omit<React.HTMLAttributes<HTMLOListElement>, "children"> {
	/** Rows in rank order (the caller sorts). */
	readonly items: readonly RankedBarItem[];
	/** Accessible name of the list, e.g. "Merchants ranked by sales". */
	readonly label: string;
	/** One series → one colour: every bar takes the same slot (bar length already encodes the value). */
	readonly color?: ChartColorSlot;
	/** Show the 1, 2, 3… rank before each row. */
	readonly showRank?: boolean;
	/**
	 * `uniform` (default): every bar in the slot colour — the length carries the value.
	 * `ranked`: ordered lightness, the first rank strongest — for lists where the ORDER is the point.
	 */
	readonly tone?: "uniform" | "ranked";
	readonly state?: ChartFrameState;
}

/** Full scale of a bar track, in percent. */
const FULL_SCALE_PERCENT = 100;
/** A non-zero value never renders as an invisible bar. */
const MIN_VISIBLE_BAR_PERCENT = 1;

/** The bar length of `value` against the largest value, 0–100; a non-zero value is at least a sliver. */
export function rankedBarPercent(value: number, maxValue: number): number {
	if (maxValue <= 0 || value <= 0) {
		return 0;
	}
	return Math.max(MIN_VISIBLE_BAR_PERCENT, Math.min(FULL_SCALE_PERCENT, (value / maxValue) * FULL_SCALE_PERCENT));
}

/**
 * A ranked breakdown as horizontal bars: name and formatted value as text on
 * every row (the bar is decorative — the text carries the number, so nothing
 * depends on reading a length or a colour), scaled to the largest row.
 */
export const RankedBarList = React.forwardRef<HTMLOListElement, RankedBarListProps>(function RankedBarList(
	{ items, label, color = "chart-1", showRank = false, tone = "uniform", state = CHART_READY, className, ...props },
	ref,
): React.JSX.Element {
	const maxValue = items.reduce((max, item) => Math.max(max, item.value), 0);
	return (
		<ChartStateFrame state={state} height="sm">
			<ol ref={ref} aria-label={label} className={cn("flex flex-col gap-3", className)} {...props}>
				{items.map((item, index) => (
					<li key={item.key} className="flex min-w-0 items-start gap-3">
						{showRank ? (
							<span aria-hidden="true" className="w-5 shrink-0 pt-0.5 text-right text-xs font-medium text-muted-foreground tabular-nums">
								{index + 1}
							</span>
						) : null}
						<div className="flex min-w-0 flex-1 flex-col gap-1.5">
							<div className="flex items-baseline justify-between gap-3 text-sm">
								<span className="truncate font-medium text-foreground" title={item.label}>
									{item.label}
								</span>
								<span className="shrink-0 font-semibold text-foreground tabular-nums">{item.valueLabel}</span>
							</div>
							<div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
								<div
									className={cn("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", CHART_SLOT_BACKGROUNDS[color])}
									style={{
										width: `${String(rankedBarPercent(item.value, maxValue))}%`,
										opacity: tone === "ranked" ? rankOpacity(index, items.length) : 1,
									}}
								/>
							</div>
							{item.detail === undefined ? null : <p className="truncate text-xs text-muted-foreground">{item.detail}</p>}
						</div>
					</li>
				))}
			</ol>
		</ChartStateFrame>
	);
});
RankedBarList.displayName = "RankedBarList";
