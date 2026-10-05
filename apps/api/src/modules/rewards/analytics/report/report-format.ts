import {
	localDateInTimeZone,
	PLATFORM_DISPLAY_REGION,
	SALE_CURRENCY_MINOR_UNIT_EXPONENTS,
	type AnalyticsInterval,
	type AnalyticsReportRange,
	type SaleCurrency,
} from "@workspace/shared";
import type { AnalyticsReportUnit } from "./analytics-report";

/** Base of the minor-unit exponent (10^2 sen = RM 1). */
const DECIMAL_BASE = 10;

/** Human name of each bucket width. */
export const ANALYTICS_INTERVAL_LABELS: Readonly<Record<AnalyticsInterval, string>> = {
	day: "Daily",
	week: "Weekly (Monday start)",
	month: "Monthly",
};

/** `minor` in major units of `currency` (1850 sen → 18.5) — what a spreadsheet stores in a currency cell. */
export function minorToMajor(minor: number, currency: SaleCurrency): number {
	return minor / DECIMAL_BASE ** SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency];
}

/** `minor` as a fixed-decimal string in major units (1850 → "18.50") — exact, locale-free (CSV). */
export function minorToDecimalString(minor: number, currency: SaleCurrency): string {
	return minorToMajor(minor, currency).toFixed(SALE_CURRENCY_MINOR_UNIT_EXPONENTS[currency]);
}

const moneyFormatters = new Map<SaleCurrency, Intl.NumberFormat>();

/** `minor` as display money in the platform locale ("RM 18.50"). */
export function formatMoney(minor: number, currency: SaleCurrency): string {
	let formatter = moneyFormatters.get(currency);
	if (formatter === undefined) {
		formatter = new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, { style: "currency", currency, currencyDisplay: "symbol" });
		moneyFormatters.set(currency, formatter);
	}
	return formatter.format(minorToMajor(minor, currency));
}

const countFormatter = new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A count with grouping ("1,234"). */
export function formatCount(value: number): string {
	return countFormatter.format(value);
}

/** A percentage with one decimal ("12.5%"). */
export function formatPercent(value: number): string {
	return `${percentFormatter.format(value)}%`;
}

/** A KPI value in its unit, for display. */
export function formatUnitValue(value: number, unit: AnalyticsReportUnit, currency: SaleCurrency): string {
	switch (unit) {
		case "money":
			return formatMoney(value, currency);
		case "count":
			return formatCount(value);
		case "percent":
			return formatPercent(value);
	}
}

/** "+12.5% vs previous", "−3 vs previous" (no base), or "no change". */
export function formatChange(change: number, changePercent: number | null, unit: AnalyticsReportUnit, currency: SaleCurrency): string {
	if (change === 0) {
		return "No change vs previous period";
	}
	const sign = change > 0 ? "+" : "-";
	if (changePercent !== null) {
		return `${sign}${formatPercent(Math.abs(changePercent))} vs previous period`;
	}
	return `${sign}${formatUnitValue(Math.abs(change), unit, currency)} vs previous period (no base)`;
}

/** "2026-09-01 to 2026-09-30 (Asia/Kuala_Lumpur)" — the last day INCLUDED (`to` is exclusive). */
export function formatRange(range: Pick<AnalyticsReportRange, "from" | "to" | "timeZone">): string {
	return `${localDateInTimeZone(range.from, range.timeZone)} to ${localDateInTimeZone(range.to - 1, range.timeZone)} (${range.timeZone})`;
}

/** Characters of `YYYY-MM-DDTHH:MM` at the start of `Date#toISOString()`. */
const ISO_MINUTE_PRECISION_LENGTH = 16;

/** An instant as `YYYY-MM-DD HH:MM UTC` — the report's "generated at" stamp. */
export function formatTimestampUtc(epochMs: number): string {
	return `${new Date(epochMs).toISOString().slice(0, ISO_MINUTE_PRECISION_LENGTH).replace("T", " ")} UTC`;
}
