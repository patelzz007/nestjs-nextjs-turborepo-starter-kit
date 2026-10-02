// ============================================
// lib/format/money.ts - money display formatting
// ============================================
// Money crosses the API as an integer count of the currency's MINOR unit
// (sen for MYR, cents for USD) plus an ISO 4217 code. These helpers are the
// one sanctioned way to render it in every app (web, merchant, admin) — never
// divide by 100 by hand, since not every currency has two decimals.

/** Locale money is displayed in ("RM 1,234.50"). */
export const MONEY_DISPLAY_LOCALE = "en-MY";

/** Base of the decimal system — a currency with `n` minor digits has 10^n minor units per major unit. */
const DECIMAL_BASE = 10;

/** At most one decimal on compact amounts ("RM 12.3K"). */
const COMPACT_FRACTION_DIGITS = 1;

const standardFormatters = new Map<string, Intl.NumberFormat>();
const compactFormatters = new Map<string, Intl.NumberFormat>();

function standardFormatter(currency: string): Intl.NumberFormat {
	const cached = standardFormatters.get(currency);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.NumberFormat(MONEY_DISPLAY_LOCALE, { style: "currency", currency });
	standardFormatters.set(currency, formatter);
	return formatter;
}

function compactFormatter(currency: string): Intl.NumberFormat {
	const cached = compactFormatters.get(currency);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.NumberFormat(MONEY_DISPLAY_LOCALE, {
		style: "currency",
		currency,
		notation: "compact",
		maximumFractionDigits: COMPACT_FRACTION_DIGITS,
	});
	compactFormatters.set(currency, formatter);
	return formatter;
}

/** Number of minor-unit digits of `currency` (2 for MYR, 0 for JPY), per the runtime's ISO 4217 data. */
export function minorUnitDigits(currency: string): number {
	return standardFormatter(currency).resolvedOptions().maximumFractionDigits ?? 0;
}

/** Converts an amount in minor units to major units (`123450` sen → `1234.5` ringgit). */
export function minorToMajorUnits(minor: number, currency: string): number {
	return minor / DECIMAL_BASE ** minorUnitDigits(currency);
}

/** `123450, "MYR"` → `"RM 1,234.50"` — full precision, for values and tooltips. */
export function formatMinorUnits(minor: number, currency: string): string {
	return standardFormatter(currency).format(minorToMajorUnits(minor, currency));
}

/** `12345678, "MYR"` → `"RM 123.5K"` — abbreviated, for chart axes and tight spaces. */
export function formatMinorUnitsCompact(minor: number, currency: string): string {
	return compactFormatter(currency).format(minorToMajorUnits(minor, currency));
}
