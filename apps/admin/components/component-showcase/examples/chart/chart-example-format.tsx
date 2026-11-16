"use client";

// Formatting shared by the Chart examples: axis ticks, the tooltip's period
// header and value formats. Hoisted here so each example passes stable
// function references to recharts and the kit's `ChartTooltipContent`.

import type * as React from "react";

/** The year the gallery's monthly sample series belong to. */
const SAMPLE_YEAR = 2024;

/** Characters kept by `abbreviateMonth` ("January" → "Jan"). */
const MONTH_ABBREVIATION_LENGTH = 3;

/** Axis tick for month names: "January" → "Jan". */
export function abbreviateMonth(month: string): string {
	return month.slice(0, MONTH_ABBREVIATION_LENGTH);
}

/** Tooltip header naming the hovered month and the sample year, ruled off from the rows. */
export function formatMonthTooltipLabel(label: React.ReactNode): React.ReactNode {
	return (
		<div className="mb-0.5 border-b border-border/50 pb-2">
			<span className="text-xs font-medium">
				{label} {SAMPLE_YEAR}
			</span>
		</div>
	);
}

const USD_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Whole US dollars: 2400 → "$2,400". */
export function formatUsd(value: number): string {
	return USD_FORMAT.format(value);
}

/** The top of a 0–100 score scale. */
export const SCORE_MAX = 100;

/** A score out of 100: 76 → "76/100". */
export function formatScore(value: number): string {
	return `${String(value)}/${String(SCORE_MAX)}`;
}
