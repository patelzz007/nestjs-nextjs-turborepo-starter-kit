"use client";

import { ChartStateFrame, CHART_READY, type ChartFrameState } from "@workspace/ui/components/analytics/analytics-panel";
import { CHART_SLOT_BACKGROUNDS, type ChartColorSlot } from "@workspace/ui/lib/charts/chart-colors";
import { CHART_SLOT_ENCODINGS, chartPatternStyle } from "@workspace/ui/lib/charts/chart-encodings";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** One part of the whole. */
export interface ShareSegment {
	readonly key: string;
	readonly label: string;
	/** ≥ 0; the segment's width is its share of the sum of all values. */
	readonly value: number;
	readonly valueLabel: string;
	/** The share as text, e.g. "64%". */
	readonly shareLabel: string;
	/** Fixed per entity (slot order), never by rank. */
	readonly color: ChartColorSlot;
}

export interface ShareBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
	/** At most a handful of parts — fold the tail into "Other" before passing them. */
	readonly segments: readonly ShareSegment[];
	/** Accessible name of the breakdown, e.g. "Redemptions by method". */
	readonly label: string;
	readonly state?: ChartFrameState;
}

const FULL_SCALE_PERCENT = 100;

/** Each segment's width in percent of the total; all zero when the total is zero. */
export function shareWidths(values: readonly number[]): readonly number[] {
	const total = values.reduce((sum, value) => sum + Math.max(0, value), 0);
	return values.map((value) => (total <= 0 ? 0 : (Math.max(0, value) / total) * FULL_SCALE_PERCENT));
}

/**
 * Part-to-whole as ONE stacked horizontal bar (2px surface gaps between parts,
 * each part in its slot's colour AND hatch pattern, so parts stay apart in a
 * monochrome theme) with a legend that states every part's name, value and share — the legend is
 * the accessible reading; the bar is the at-a-glance shape.
 */
export const ShareBar = React.forwardRef<HTMLDivElement, ShareBarProps>(function ShareBar(
	{ segments, label, state = CHART_READY, className, ...props },
	ref,
): React.JSX.Element {
	const widths = shareWidths(segments.map((segment) => segment.value));
	const parts = segments.map((segment, index) => ({ segment, width: widths[index] ?? 0 })).filter((part) => part.width > 0);
	return (
		<ChartStateFrame state={state} height="sm">
			<div ref={ref} className={cn("flex flex-col gap-4", className)} {...props}>
				<div aria-hidden="true" className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
					{parts.map(({ segment, width }) => (
						<div
							key={segment.key}
							data-pattern={CHART_SLOT_ENCODINGS[segment.color].pattern}
							className={cn("h-full", CHART_SLOT_BACKGROUNDS[segment.color])}
							style={{ width: `${String(width)}%`, ...chartPatternStyle(CHART_SLOT_ENCODINGS[segment.color].pattern) }}
						/>
					))}
				</div>
				<ul aria-label={label} className="flex flex-col gap-2">
					{segments.map((segment) => (
						<li key={segment.key} className="flex items-center gap-2 text-sm">
							<span
								aria-hidden="true"
								data-pattern={CHART_SLOT_ENCODINGS[segment.color].pattern}
								className={cn("size-3 shrink-0 rounded-xs", CHART_SLOT_BACKGROUNDS[segment.color])}
								style={chartPatternStyle(CHART_SLOT_ENCODINGS[segment.color].pattern)}
							/>
							<span className="min-w-0 flex-1 truncate text-foreground">{segment.label}</span>
							<span className="shrink-0 font-semibold text-foreground tabular-nums">{segment.valueLabel}</span>
							<span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">{segment.shareLabel}</span>
						</li>
					))}
				</ul>
			</div>
		</ChartStateFrame>
	);
});
ShareBar.displayName = "ShareBar";
