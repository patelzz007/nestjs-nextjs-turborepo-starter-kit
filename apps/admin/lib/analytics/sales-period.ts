import { AdminSalesAnalyticsQuerySchema, analyticsQueryForWeeks, DEFAULT_ANALYTICS_WEEKS, type AdminSalesAnalyticsQuery } from "@workspace/shared";
import { z } from "zod";

/** The period presets the sales analytics page offers, in weeks. */
export const SalesPeriodWeeksSchema = z.union([z.literal(4), z.literal(8), z.literal(12)]);

export type SalesPeriodWeeks = z.output<typeof SalesPeriodWeeksSchema>;

/**
 * The API's default period (`DEFAULT_ANALYTICS_WEEKS`), so `/analytics/sales`
 * without `?weeks=` matches the dashboard summary. Parsed through the preset
 * schema: if the API default ever stops being a preset, the app fails at load
 * instead of offering a period the picker cannot show.
 */
export const DEFAULT_SALES_PERIOD_WEEKS: SalesPeriodWeeks = SalesPeriodWeeksSchema.parse(DEFAULT_ANALYTICS_WEEKS);

/** A preset as it arrives in the URL or a `<select>` value (`"8"`). */
export const SalesPeriodWeeksParamSchema = z.coerce.number().pipe(SalesPeriodWeeksSchema);

export interface SalesPeriodPreset {
	readonly weeks: SalesPeriodWeeks;
	readonly label: string;
}

export const SALES_PERIOD_PRESETS: readonly [SalesPeriodPreset, SalesPeriodPreset, SalesPeriodPreset] = [
	{ weeks: 4, label: "Last 4 weeks" },
	{ weeks: 8, label: "Last 8 weeks" },
	{ weeks: 12, label: "Last 12 weeks" },
];

/**
 * The query for the `weeks` weeks that end at `nowMs`, aligned like the API's
 * own default: `from` is a UTC week start and the current week counts as one,
 * so every bucket of the chart is a whole week.
 */
export function resolveSalesPeriodQuery(weeks: SalesPeriodWeeks, nowMs: number): AdminSalesAnalyticsQuery {
	return AdminSalesAnalyticsQuerySchema.parse(analyticsQueryForWeeks(weeks, nowMs));
}

/** Display label of a preset ("Last 8 weeks"). */
export function salesPeriodLabel(weeks: SalesPeriodWeeks): string {
	return SALES_PERIOD_PRESETS.find((preset) => preset.weeks === weeks)?.label ?? `Last ${String(weeks)} weeks`;
}
