// ============================================
// lib/format/number.ts - count formatting
// ============================================
// The one sanctioned way to render a plain count in every app — never call
// `toLocaleString()` without a locale, which follows the runtime's default
// (the Node server's and the viewer's browser's differ, so the server HTML and
// the first client render would disagree). Money has its own helpers in
// `money.ts`.

import { normalizeIntlSpacing } from "./intl-text";

const countFormatters = new Map<string, Intl.NumberFormat>();

/** `1234567, "en-MY"` → `"1,234,567"` — a count with the given locale's digit grouping. */
export function formatCount(value: number, locale: string): string {
	const cached = countFormatters.get(locale);
	if (cached !== undefined) {
		return normalizeIntlSpacing(cached.format(value));
	}
	const formatter = new Intl.NumberFormat(locale);
	countFormatters.set(locale, formatter);
	return normalizeIntlSpacing(formatter.format(value));
}

// ── Percentages ────────────────────────────────────────────────────────────
// The API sends percentages in percent units with one decimal (`12.5` = 12.5 %),
// so these take that unit and divide by 100 for `Intl`'s percent style.

/** Percent units per whole (`12.5` % = 0.125). */
const PERCENT_UNITS_PER_WHOLE = 100;

/** One decimal — the precision the API computes percentages to. */
const PERCENT_FRACTION_DIGITS = 1;

/** Separates the parts of a formatter cache key; never occurs in a locale tag. */
const PERCENT_CACHE_KEY_SEPARATOR = "|";

/** How a percentage is signed: plain (`12.5%`) or always signed for a change (`+12.5%`, `−3%`, `0%`). */
export type PercentSign = "plain" | "change";

const percentFormatters = new Map<string, Intl.NumberFormat>();

function percentFormatter(locale: string, sign: PercentSign): Intl.NumberFormat {
	const key = `${locale}${PERCENT_CACHE_KEY_SEPARATOR}${sign}`;
	const cached = percentFormatters.get(key);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: PERCENT_FRACTION_DIGITS,
		signDisplay: sign === "change" ? "exceptZero" : "auto",
	});
	percentFormatters.set(key, formatter);
	return formatter;
}

/** `12.5, "en-MY"` → `"12.5%"` — a percentage given in percent units, at most one decimal. */
export function formatPercent(percent: number, locale: string): string {
	return normalizeIntlSpacing(percentFormatter(locale, "plain").format(percent / PERCENT_UNITS_PER_WHOLE));
}

/** `12.5, "en-MY"` → `"+12.5%"`; `-3` → `"-3%"`; `0` → `"0%"` — a signed change in percent units. */
export function formatPercentChange(percent: number, locale: string): string {
	return normalizeIntlSpacing(percentFormatter(locale, "change").format(percent / PERCENT_UNITS_PER_WHOLE));
}
