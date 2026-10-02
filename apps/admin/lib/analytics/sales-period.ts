import { AdminSalesAnalyticsQuerySchema, type AdminSalesAnalyticsQuery } from "@workspace/shared";
import { z } from "zod";

/** Milliseconds in one week — the analytics series is bucketed by week. */
export const WEEK_MS = 604_800_000;

/** The period presets the sales analytics page offers, in weeks. */
export const SalesPeriodWeeksSchema = z.union([z.literal(4), z.literal(8), z.literal(12)]);

export type SalesPeriodWeeks = z.output<typeof SalesPeriodWeeksSchema>;

/** Same as the API's default period, so `/analytics/sales` without `?weeks=` matches the dashboard summary. */
export const DEFAULT_SALES_PERIOD_WEEKS: SalesPeriodWeeks = 8;

export interface SalesPeriodPreset {
	readonly weeks: SalesPeriodWeeks;
	readonly label: string;
}

export const SALES_PERIOD_PRESETS: readonly [SalesPeriodPreset, SalesPeriodPreset, SalesPeriodPreset] = [
	{ weeks: 4, label: "Last 4 weeks" },
	{ weeks: 8, label: "Last 8 weeks" },
	{ weeks: 12, label: "Last 12 weeks" },
];

/** `?weeks=` as it arrives from the URL; anything that is not a preset falls back to the default. */
const SalesPeriodWeeksParamSchema = z.coerce.number().pipe(SalesPeriodWeeksSchema).catch(DEFAULT_SALES_PERIOD_WEEKS);

/** Reads the `?weeks=` search param (string, repeated, or absent) as a preset. */
export function parseSalesPeriodWeeks(value: string | readonly string[] | undefined): SalesPeriodWeeks {
	return SalesPeriodWeeksParamSchema.parse(typeof value === "string" ? value : undefined);
}

/** `{ from, to }` covering the `weeks` weeks that end at `nowMs`. */
export function resolveSalesPeriodQuery(weeks: SalesPeriodWeeks, nowMs: number): AdminSalesAnalyticsQuery {
	return AdminSalesAnalyticsQuerySchema.parse({ from: nowMs - weeks * WEEK_MS, to: nowMs });
}

/** Display label of a preset ("Last 8 weeks"). */
export function salesPeriodLabel(weeks: SalesPeriodWeeks): string {
	return SALES_PERIOD_PRESETS.find((preset) => preset.weeks === weeks)?.label ?? `Last ${String(weeks)} weeks`;
}
